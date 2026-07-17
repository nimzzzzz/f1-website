const BASE = 'https://api.openf1.org/v1'

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

export interface Meeting {
  meeting_key: number
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

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
  options: RequestInit = {}
): Promise<T[]> {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  try {
    const res = await fetch(url.toString(), options)
    if (res.status === 401) {
      // readable only server-side; browsers hit the catch path instead
      setApiBlocked(true)
      console.error(`[OpenF1] 401 (live-session lockout) — ${url}`)
      return []
    }
    if (!res.ok) {
      console.error(`[OpenF1] ${res.status} ${res.statusText} — ${url}`)
      return []
    }
    setApiBlocked(false)
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data as T[]
  } catch (err) {
    void classifyFailure()
    console.error(`[OpenF1] fetch failed — ${url}`, err)
    return []
  }
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getMeetings(): Promise<Meeting[]> {
  return apiFetch<Meeting>('/meetings', { year: 2026 }, { next: { revalidate: 60 } })
}

export async function getMeetingsByYear(year: number): Promise<Meeting[]> {
  return apiFetch<Meeting>('/meetings', { year }, { next: { revalidate: 3600 } })
}

export async function getSessions(meetingKey?: number): Promise<Session[]> {
  const params: Record<string, string | number> = { year: 2026 }
  if (meetingKey !== undefined) params.meeting_key = meetingKey
  return apiFetch<Session>('/sessions', params, { next: { revalidate: 60 } })
}

export async function getAllSessions(): Promise<Session[]> {
  return apiFetch<Session>('/sessions', { year: 2026 }, { next: { revalidate: 60 } })
}

export async function getSessionsByYear(year: number): Promise<Session[]> {
  return apiFetch<Session>('/sessions', { year }, { next: { revalidate: 3600 } })
}

export async function getDrivers(sessionKey: number): Promise<Driver[]> {
  return apiFetch<Driver>('/drivers', { session_key: sessionKey }, { next: { revalidate: 60 } })
}

export async function getLaps(
  sessionKey: number,
  driverNumber?: number,
  limit?: number
): Promise<Lap[]> {
  const params: Record<string, string | number> = { session_key: sessionKey }
  if (driverNumber !== undefined) params.driver_number = driverNumber
  if (limit !== undefined) params.limit = limit
  return apiFetch<Lap>('/laps', params, { cache: 'no-store' })
}

export async function getPositions(sessionKey: number): Promise<Position[]> {
  return apiFetch<Position>('/position', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getPitStops(sessionKey: number): Promise<PitStop[]> {
  return apiFetch<PitStop>('/pit', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getWeather(sessionKey: number): Promise<Weather[]> {
  return apiFetch<Weather>('/weather', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getRaceControl(sessionKey: number): Promise<RaceControl[]> {
  return apiFetch<RaceControl>('/race_control', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getTeamRadio(sessionKey: number): Promise<TeamRadio[]> {
  return apiFetch<TeamRadio>('/team_radio', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getStints(sessionKey: number): Promise<Stint[]> {
  return apiFetch<Stint>('/stints', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getIntervals(sessionKey: number): Promise<Interval[]> {
  return apiFetch<Interval>('/intervals', { session_key: sessionKey }, { cache: 'no-store' })
}

export async function getSessionResult(sessionKey: number): Promise<SessionResult[]> {
  return apiFetch<SessionResult>('/session_result', { session_key: sessionKey }, { cache: 'no-store' })
}

// ─── Batch Fetch Helper ──────────────────────────────────────────────────────

export async function fetchAllSessionResults(
  sessionKeys: number[],
  getCached: (key: number) => Promise<SessionResult[]>
): Promise<Map<number, SessionResult[]>> {
  const results = await Promise.all(
    sessionKeys.map(async (key) => ({ key, data: await getCached(key) }))
  )
  const map = new Map<number, SessionResult[]>()
  const empties: number[] = []
  for (const { key, data } of results) {
    if (data.length > 0) map.set(key, data)
    else empties.push(key)
  }
  for (const key of empties) {
    await new Promise((r) => setTimeout(r, 800))
    const data = await getCached(key)
    if (data.length > 0) map.set(key, data)
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

export const CANCELLED_COUNTRIES = new Set(['Bahrain', 'Saudi Arabia'])
