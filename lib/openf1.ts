// Browser fetches go through our caching proxy (/api/openf1/*), which
// serves last-known data through openf1's live-session 401 lockouts and
// rate limits; server-side code (the season bundle compute) talks to
// openf1 directly.
const BASE =
  typeof window !== 'undefined' ? '/api/openf1' : 'https://api.openf1.org/v1'

import { normalizeSessionResults, normalizeDrivers, describeReport } from '@/lib/openf1-normalize'
import { type FetchResult, okResult, failResult, rowsOrEmpty, isRetryable } from '@/lib/fetch-result'
export type { FetchResult } from '@/lib/fetch-result'

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

export interface Meeting {
  meeting_key: number
  /** openf1 marks replaced/abandoned rounds here. Cancellation is per
   *  MEETING — never infer it from country_name (see CANCELLED_MEETING_KEYS). */
  is_cancelled?: boolean
  meeting_name: string
  meeting_official_name: string
  location: string
  country_code: string
  country_name: string
  country_flag: string
  circuit_short_name: string
  circuit_type: string
  circuit_image: string
  gmt_offset: string
  date_start: string
  date_end: string
  year: number
}

export interface Session {
  session_key: number
  /** Mirrors the parent meeting's cancellation flag. */
  is_cancelled?: boolean
  session_type: string
  session_name: string
  date_start: string
  date_end: string
  meeting_key: number
  circuit_short_name: string
  country_code: string
  country_name: string
  location: string
  gmt_offset: string
  year: number
}

export interface Driver {
  driver_number: number
  broadcast_name: string
  full_name: string
  name_acronym: string
  team_name: string
  team_colour: string
  first_name: string
  last_name: string
  headshot_url: string
  country_code: string | null
  meeting_key: number
  session_key: number
}

export interface Lap {
  meeting_key: number
  session_key: number
  driver_number: number
  i1_speed: number | null
  i2_speed: number | null
  st_speed: number | null
  date_start: string
  lap_duration: number | null
  is_pit_out_lap: boolean
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  segments_sector_1: number[] | null
  segments_sector_2: number[] | null
  segments_sector_3: number[] | null
  lap_number: number
}

export interface Position {
  meeting_key: number
  session_key: number
  driver_number: number
  date: string
  position: number
}

export interface PitStop {
  meeting_key: number
  session_key: number
  driver_number: number
  date: string
  lap_number: number
  pit_duration: number | null
  pit_in_time: string | null
  pit_out_time: string | null
}

export interface Weather {
  meeting_key: number
  session_key: number
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  pressure: number
  wind_direction: number
  wind_speed: number
  rainfall: boolean
}

export interface RaceControl {
  meeting_key: number
  session_key: number
  date: string
  driver_number: number | null
  lap_number: number | null
  category: string
  flag: string | null
  scope: string | null
  sector: number | null
  message: string
}

export interface TeamRadio {
  meeting_key: number
  session_key: number
  driver_number: number
  date: string
  recording_url: string
}

export interface Stint {
  meeting_key: number
  session_key: number
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number
  compound: string
  tyre_age_at_start: number
}

export interface Interval {
  meeting_key: number
  session_key: number
  driver_number: number
  date: string
  gap_to_leader: number | null
  interval: number | null
}

export interface CarData {
  meeting_key: number
  session_key: number
  driver_number: number
  date: string
  rpm: number
  speed: number
  n_gear: number
  throttle: number
  brake: boolean
  drs: number
}

export interface SessionResult {
  session_key: number
  meeting_key: number
  driver_number: number
  position: number | null
  number_of_laps: number
  points: number
  dnf: boolean
  dns: boolean
  dsq: boolean
  duration: number | number[] | null
  gap_to_leader: number | number[] | null
}

// ─── Live-session lockout signal ─────────────────────────────────────────────
// While an F1 session is live, openf1 401s every unauthenticated request.
// In the browser the 401 is unreadable (the error response carries no CORS
// headers, so fetch throws before a status exists), so failures are
// classified through the same-origin /api/openf1-status probe, which reads
// the real status server-side. All fetchers keep the return-[] contract;
// this signal only tells UIs *why* data is absent.

let apiBlocked = false
let lastProbeAt = 0
const blockedListeners = new Set<() => void>()

export function isApiBlocked(): boolean {
  return apiBlocked
}

// useSyncExternalStore-compatible subscription
export function subscribeApiBlocked(listener: () => void): () => void {
  blockedListeners.add(listener)
  return () => {
    blockedListeners.delete(listener)
  }
}

function setApiBlocked(value: boolean) {
  if (apiBlocked === value) return
  apiBlocked = value
  blockedListeners.forEach((fn) => fn())
}

const PROBE_INTERVAL_MS = 30_000

async function classifyFailure() {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastProbeAt < PROBE_INTERVAL_MS) return
  lastProbeAt = now
  try {
    const res = await fetch('/api/openf1-status', { cache: 'no-store' })
    if (!res.ok) return
    const body = (await res.json()) as { blocked?: boolean }
    setApiBlocked(Boolean(body.blocked))
  } catch {
    // probe itself unreachable — leave the current classification alone
  }
}

// ─── Core Fetch ──────────────────────────────────────────────────────────────

/**
 * Returns a FetchResult, not T[]. See lib/fetch-result for why: collapsing
 * every failure to [] made an outage indistinguishable from an empty
 * session, which both lied to users and forced retry logic to treat EMPTY
 * as retryable.
 */
async function apiFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
  options: RequestInit = {}
): Promise<FetchResult<T>> {
  // BASE is relative in the browser (the proxy) — anchor it to the origin
  const url = new URL(
    `${BASE}${path}`,
    typeof window !== 'undefined' ? window.location.origin : undefined
  )
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  try {
    const res = await fetch(url.toString(), options)
    if (res.status === 401) {
      // readable only server-side; browsers hit the catch path instead
      setApiBlocked(true)
      console.error(`[OpenF1] 401 (live-session lockout) — ${url}`)
      return failResult<T>('blocked', 401)
    }
    if (res.status === 429) {
      console.error(`[OpenF1] 429 rate limited — ${url}`)
      return failResult<T>('rate-limited', 429)
    }
    if (!res.ok) {
      console.error(`[OpenF1] ${res.status} ${res.statusText} — ${url}`)
      return failResult<T>('http', res.status)
    }
    setApiBlocked(false)
    const data = await res.json()
    if (!Array.isArray(data)) {
      console.error(`[OpenF1] non-array body — ${url}`)
      return failResult<T>('malformed', res.status)
    }
    return okResult(data as T[])
  } catch (err) {
    void classifyFailure()
    console.error(`[OpenF1] fetch failed — ${url}`, err)
    return failResult<T>('network')
  }
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getMeetings(): Promise<FetchResult<Meeting>> {
  return apiFetch<Meeting>('/meetings', { year: 2026 }, { next: { revalidate: 60 } })
}

export async function getMeetingsByYear(year: number): Promise<FetchResult<Meeting>> {
  return apiFetch<Meeting>('/meetings', { year }, { next: { revalidate: 3600 } })
}

export async function getSessions(meetingKey?: number): Promise<FetchResult<Session>> {
  const params: Record<string, string | number> = { year: 2026 }
  if (meetingKey !== undefined) params.meeting_key = meetingKey
  return apiFetch<Session>('/sessions', params, { next: { revalidate: 60 } })
}

export async function getAllSessions(): Promise<FetchResult<Session>> {
  return apiFetch<Session>('/sessions', { year: 2026 }, { next: { revalidate: 60 } })
}

export async function getSessionsByYear(year: number): Promise<FetchResult<Session>> {
  return apiFetch<Session>('/sessions', { year }, { next: { revalidate: 3600 } })
}

export async function getDrivers(sessionKey: number): Promise<FetchResult<Driver>> {
  const res = await apiFetch<Driver>('/drivers', { session_key: sessionKey }, { next: { revalidate: 60 } })
  if (!res.ok) return res
  // THE BOUNDARY — see lib/openf1-normalize. Rows arrive validated and
  // numerically coerced, so no downstream call site can compute on a string.
  const { rows, report } = normalizeDrivers(res.rows)
  const msg = describeReport(`drivers session=${sessionKey}`, report)
  if (msg) console.warn(msg)
  return okResult(rows as unknown as Driver[])
}

export async function getLaps(
  sessionKey: number,
  driverNumber?: number,
  limit?: number
): Promise<FetchResult<Lap>> {
  const params: Record<string, string | number> = { session_key: sessionKey }
  if (driverNumber !== undefined) params.driver_number = driverNumber
  if (limit !== undefined) params.limit = limit
  return apiFetch<Lap>('/laps', params, { cache: 'no-store' })
}

export async function getPositions(sessionKey: number): Promise<FetchResult<Position>> {
  return apiFetch<Position>('/position', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getPitStops(sessionKey: number): Promise<FetchResult<PitStop>> {
  return apiFetch<PitStop>('/pit', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getWeather(sessionKey: number): Promise<FetchResult<Weather>> {
  return apiFetch<Weather>('/weather', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getRaceControl(sessionKey: number): Promise<FetchResult<RaceControl>> {
  return apiFetch<RaceControl>('/race_control', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getTeamRadio(sessionKey: number): Promise<FetchResult<TeamRadio>> {
  return apiFetch<TeamRadio>('/team_radio', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getStints(sessionKey: number): Promise<FetchResult<Stint>> {
  return apiFetch<Stint>('/stints', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getIntervals(sessionKey: number): Promise<FetchResult<Interval>> {
  return apiFetch<Interval>('/intervals', { session_key: sessionKey }, { cache: 'no-store' })
}

/**
 * Every session's results for a meeting in ONE request. Per-session roster
 * attribution needs a roster per session as well as a result set per
 * session; fetched individually that is two requests per session, which
 * measurably trips openf1's rate limit (a burst of 8 returns 429 for half).
 * meeting_key collapses a whole weekend into one call.
 */
export async function getSessionResultsForMeeting(meetingKey: number): Promise<FetchResult<SessionResult>> {
  // revalidate-tagged, NOT no-store. A no-store fetch during static
  // generation is "Dynamic server usage" and opts the whole route out of
  // prerendering — it silently cost 5 of 11 team pages. The per-session
  // getSessionResult keeps no-store because it also serves live client
  // polling; this one is build/server-only.
  const res = await apiFetch<SessionResult>('/session_result', { meeting_key: meetingKey }, { next: { revalidate: 60 } })
  if (!res.ok) return res
  const { rows, report } = normalizeSessionResults(res.rows)
  const msg = describeReport(`session_result meeting=${meetingKey}`, report)
  if (msg) console.warn(msg)
  return okResult(rows as unknown as SessionResult[])
}

/** Every session's roster for a meeting in ONE request. */
export async function getDriversForMeeting(meetingKey: number): Promise<FetchResult<Driver>> {
  const res = await apiFetch<Driver>('/drivers', { meeting_key: meetingKey }, { next: { revalidate: 60 } })
  if (!res.ok) return res
  const { rows, report } = normalizeDrivers(res.rows)
  const msg = describeReport(`drivers meeting=${meetingKey}`, report)
  if (msg) console.warn(msg)
  return okResult(rows as unknown as Driver[])
}

export async function getSessionResult(sessionKey: number): Promise<FetchResult<SessionResult>> {
  const res = await apiFetch<SessionResult>('/session_result', { session_key: sessionKey }, { cache: 'no-store' })
  if (!res.ok) return res
  const { rows, report } = normalizeSessionResults(res.rows)
  const msg = describeReport(`session_result session=${sessionKey}`, report)
  if (msg) console.warn(msg)
  return okResult(rows as unknown as SessionResult[])
}

// ─── Batch Fetch Helper ──────────────────────────────────────────────────────

/**
 * Fetch results for many sessions, retrying only the ones that actually
 * FAILED. This used to retry every empty response, because empty was all a
 * failure looked like — so a session that genuinely had no rows cost an
 * extra 800ms round trip while a rate-limited one got no special treatment.
 */
export async function fetchAllSessionResults(
  sessionKeys: number[],
  getCached: (key: number) => Promise<FetchResult<SessionResult>>
): Promise<Map<number, SessionResult[]>> {
  const settled = await Promise.all(
    sessionKeys.map(async (key) => ({ key, res: await getCached(key) }))
  )
  const map = new Map<number, SessionResult[]>()
  const failed: number[] = []
  for (const { key, res } of settled) {
    if (res.ok) {
      if (res.rows.length > 0) map.set(key, res.rows)
    } else if (isRetryable(res)) {
      failed.push(key)
    }
  }
  for (const key of failed) {
    await new Promise((r) => setTimeout(r, 800))
    const res = await getCached(key)
    if (res.ok && res.rows.length > 0) map.set(key, res.rows)
  }
  return map
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getRaceMeetings(meetings: Meeting[]): Meeting[] {
  return meetings.filter(
    (m) =>
      !m.meeting_name.toLowerCase().includes('testing') &&
      !m.meeting_name.toLowerCase().includes('pre-season')
  )
}

export function getNextMeeting(meetings: Meeting[]): Meeting | null {
  const now = new Date()
  const raceMeetings = getRaceMeetings(meetings)
  const sorted = [...raceMeetings].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )
  return sorted.find((m) => new Date(m.date_start) > now) ?? null
}

export function getCurrentMeeting(meetings: Meeting[]): Meeting | null {
  const now = new Date()
  const raceMeetings = getRaceMeetings(meetings)
  return (
    raceMeetings.find((m) => {
      const start = new Date(m.date_start)
      const end = new Date(m.date_end)
      return start <= now && now < end
    }) ?? null
  )
}

export function isMeetingLive(meeting: Meeting): boolean {
  const now = new Date()
  const start = new Date(meeting.date_start)
  const end = new Date(meeting.date_end)
  return start <= now && now < end
}

export function isMeetingCompleted(meeting: Meeting): boolean {
  const now = new Date()
  return new Date(meeting.date_end) < now
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const secStr = secs.toFixed(3).padStart(6, '0')
  if (mins > 0) return `${mins}:${secStr}`
  return `${secs.toFixed(3)}`
}

export function formatGap(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds === 0) return 'Leader'
  return `+${seconds.toFixed(3)}`
}

// ─── Points Systems ───────────────────────────────────────────────────────────

export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1]

// ─── Cancelled Races ─────────────────────────────────────────────────────────
//
// Cancellation is a property of a MEETING, never of a country.
//
// This used to be `CANCELLED_COUNTRIES = {'Bahrain', 'Saudi Arabia'}`, which
// was correct only while those countries appeared exactly once each on the
// calendar. They no longer do: the cancelled Bahrain GP at Sakhir (meeting
// 1282) has been REPLACED by a Bahrain Grand Prix held in Kuala Lumpur
// (meeting 1308, 2026-10-02, is_cancelled false) which still carries
// country_name "Bahrain". A country filter silently deleted that real,
// upcoming race from the schedule, the countdown, and every season
// calculation. 2026 has three more country collisions besides — Bahrain
// also has two pre-season tests, and Spain and the United States host two
// and three rounds respectively.
//
// openf1 publishes `is_cancelled` on BOTH meetings and sessions (verified
// live), so that is the source of truth. CANCELLED_MEETING_KEYS exists only
// as a defensive fallback for the case where upstream omits the field
// entirely — it is keyed by meeting, never by country, so a replacement
// round can never be caught by it.

export const CANCELLED_MEETING_KEYS: ReadonlySet<number> = new Set([1282, 1283])

/** True when a meeting or session is cancelled. */
export function isCancelled(x: { is_cancelled?: boolean; meeting_key?: number }): boolean {
  if (typeof x.is_cancelled === 'boolean') return x.is_cancelled
  return x.meeting_key !== undefined && CANCELLED_MEETING_KEYS.has(x.meeting_key)
}

/** Meeting keys to exclude, resolved from upstream with the static fallback. */
export function cancelledMeetingKeys(meetings: Meeting[]): Set<number> {
  const keys = new Set<number>()
  for (const m of meetings) if (isCancelled(m)) keys.add(m.meeting_key)
  for (const k of CANCELLED_MEETING_KEYS) keys.add(k)
  return keys
}

/** Drop cancelled meetings. */
export const activeMeetings = (meetings: Meeting[]): Meeting[] => meetings.filter((m) => !isCancelled(m))

/**
 * Drop sessions belonging to cancelled meetings. Sessions carry their own
 * is_cancelled, but a session whose field is missing is still resolved
 * through its meeting_key so a partially-populated payload can't leak a
 * cancelled round into the tally.
 */
export function activeSessions(sessions: Session[], cancelledKeys?: Set<number>): Session[] {
  const keys = cancelledKeys ?? CANCELLED_MEETING_KEYS
  return sessions.filter((s) => !isCancelled(s) && !keys.has(s.meeting_key))
}
