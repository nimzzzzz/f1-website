import type { Meeting, Session, Weather, RaceControl, Lap, Driver, PitStop, Position, Stint, TeamRadio } from './openf1'
import {
  getMeetings,
  getAllSessions,
  getWeather,
  getRaceControl,
  getLaps,
  getDrivers,
  getPitStops,
  getPositions,
  getStints,
  getTeamRadio,
} from './openf1'

const SESSION_TTL = 5 * 60 * 1000   // 5 min — session list rarely changes
const DATA_TTL    = 3 * 60 * 1000   // 3 min — session data changes slowly

// ─── Generic cache factory ────────────────────────────────────────────────────

function makeCache<T>(fetcher: (key: number) => Promise<T[]>, ttl: number) {
  const cache = new Map<number, { data: T[]; expiresAt: number }>()
  const inflight = new Map<number, Promise<T[]>>()

  return async (key: number): Promise<T[]> => {
    const hit = cache.get(key)
    if (hit && Date.now() < hit.expiresAt) return hit.data

    const pending = inflight.get(key)
    if (pending) return pending

    const promise = fetcher(key).then((data) => {
      // Only cache non-empty results — empty arrays are likely transient API failures
      if (data.length > 0) {
        cache.set(key, { data, expiresAt: Date.now() + ttl })
      }
      inflight.delete(key)
      return data
    }).catch((err) => {
      inflight.delete(key)
      throw err
    })
    inflight.set(key, promise)
    return promise
  }
}

// ─── Meetings cache ───────────────────────────────────────────────────────────

let meetingsCache: { data: Meeting[]; expiresAt: number } | null = null
let meetingsInflight: Promise<Meeting[]> | null = null

export async function getCachedMeetings(): Promise<Meeting[]> {
  if (meetingsCache && Date.now() < meetingsCache.expiresAt) return meetingsCache.data
  if (meetingsInflight) return meetingsInflight
  meetingsInflight = getMeetings().then((data) => {
    meetingsCache = { data, expiresAt: Date.now() + SESSION_TTL }
    meetingsInflight = null
    return data
  }).catch((err) => {
    meetingsInflight = null
    throw err
  })
  return meetingsInflight
}

// ─── Sessions (shared across all pages) ───────────────────────────────────────

let sessionsCache: { data: Session[]; expiresAt: number } | null = null
let sessionsInflight: Promise<Session[]> | null = null

export async function getCachedSessions(): Promise<Session[]> {
  if (sessionsCache && Date.now() < sessionsCache.expiresAt) return sessionsCache.data
  if (sessionsInflight) return sessionsInflight
  sessionsInflight = getAllSessions().then((data) => {
    sessionsCache = { data, expiresAt: Date.now() + SESSION_TTL }
    sessionsInflight = null
    return data
  }).catch((err) => {
    sessionsInflight = null
    throw err
  })
  return sessionsInflight
}

// ─── Latest drivers (for drivers/teams pages) ────────────────────────────────

let latestDriversCache: { data: Driver[]; expiresAt: number } | null = null
let latestDriversInflight: Promise<Driver[]> | null = null

export async function getCachedLatestDrivers(): Promise<Driver[]> {
  if (latestDriversCache && Date.now() < latestDriversCache.expiresAt) return latestDriversCache.data
  if (latestDriversInflight) return latestDriversInflight
  latestDriversInflight = (async () => {
    try {
      const drivers = await getDrivers(11247)
      if (drivers.length > 0) return drivers
    } catch { /* fall through */ }
    const sessions = await getAllSessions()
    const sorted = sessions
      .filter((s) => new Date(s.date_end) < new Date())
      .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())
    if (sorted[0]) return getDrivers(sorted[0].session_key)
    return []
  })().then((data) => {
    latestDriversCache = { data, expiresAt: Date.now() + SESSION_TTL }
    latestDriversInflight = null
    return data
  }).catch((err) => {
    latestDriversInflight = null
    throw err
  })
  return latestDriversInflight
}

// ─── Per-session data caches ──────────────────────────────────────────────────

export const getCachedWeather      = makeCache<Weather>(getWeather, DATA_TTL)
export const getCachedRaceControl  = makeCache<RaceControl>(getRaceControl, DATA_TTL)
export const getCachedLaps         = makeCache<Lap>(getLaps, DATA_TTL)
export const getCachedDrivers      = makeCache<Driver>(getDrivers, DATA_TTL)
export const getCachedPitStops     = makeCache<PitStop>(getPitStops, DATA_TTL)
export const getCachedPositions    = makeCache<Position>(getPositions, DATA_TTL)
export const getCachedStints       = makeCache<Stint>(getStints, DATA_TTL)
export const getCachedTeamRadio    = makeCache<TeamRadio>(getTeamRadio, DATA_TTL)
