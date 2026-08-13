import type { Meeting, Session, Weather, RaceControl, Lap, Driver, PitStop, Position, Stint, TeamRadio, SessionResult } from './openf1'
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
  getSessionResult,
} from './openf1'
import type { FetchResult } from './fetch-result'

const SESSION_TTL = 5 * 60 * 1000   // 5 min — session list rarely changes
const DATA_TTL    = 3 * 60 * 1000   // 3 min — session data changes slowly

// A FAILURE IS NEVER CACHED.
//
// The meetings and sessions caches used to store whatever getMeetings /
// getAllSessions returned — and under the old contract a 401, a 429, a 500
// and a dropped connection all returned []. So one blip was written into a
// 5-minute cache and every consumer for the next five minutes was told, with
// full confidence, that the season had no meetings. One outage poisoned the
// next five minutes.
//
// The per-session caches sidestepped this with `if (data.length > 0)`, but
// that rule also refuses to cache a genuinely empty session — it was
// guessing at failure from emptiness because emptiness was all it had. Now
// that FetchResult distinguishes the two, every cache in this file uses the
// same rule, and it is the correct one: cache successes (including empty
// ones), never cache failures.

interface Entry<T> {
  rows: T[]
  expiresAt: number
}

/**
 * A cached fetcher that can also be asked to go and look again.
 *
 * `refresh` exists for live polling. Without it a poll calls the cached
 * fetcher, gets a hit from this 3-minute TTL, and re-commits the SAME rows
 * — so the page's freshness clock ticks every 25 seconds while the data
 * underneath it is minutes old. That is precisely the "says LIVE while
 * frozen" lie live polling was added to remove, just moved one layer down;
 * it was caught by a simulated live session showing five poll commits for
 * three network requests. Refresh bypasses the TTL, and the response still
 * populates the cache for everyone else.
 */
export interface CachedFetcher<T> {
  (key: number): Promise<FetchResult<T>>
  refresh: (key: number) => Promise<FetchResult<T>>
}

export function makeCache<T>(
  fetcher: (key: number) => Promise<FetchResult<T>>,
  ttl: number
): CachedFetcher<T> {
  const cache = new Map<number, Entry<T>>()
  const inflight = new Map<number, Promise<FetchResult<T>>>()

  const load = async (key: number, force: boolean): Promise<FetchResult<T>> => {
    const hit = cache.get(key)
    if (!force && hit && Date.now() < hit.expiresAt) return { ok: true, rows: hit.rows }

    // A forced refresh still joins an in-flight request: two pollers for
    // the same key should not become two upstream calls.
    const pending = inflight.get(key)
    if (pending) return pending

    const promise = fetcher(key)
      .then((res) => {
        if (res.ok) cache.set(key, { rows: res.rows, expiresAt: Date.now() + ttl })
        inflight.delete(key)
        return res
      })
      .catch((err) => {
        inflight.delete(key)
        throw err
      })
    inflight.set(key, promise)
    return promise
  }

  const fn = ((key: number) => load(key, false)) as CachedFetcher<T>
  fn.refresh = (key: number) => load(key, true)
  return fn
}

/** Keyless variant of the same cache, for the season-wide lists. */
export function makeSingleton<T>(fetcher: () => Promise<FetchResult<T>>, ttl: number) {
  let cache: Entry<T> | null = null
  let inflight: Promise<FetchResult<T>> | null = null

  return async (): Promise<FetchResult<T>> => {
    if (cache && Date.now() < cache.expiresAt) return { ok: true, rows: cache.rows }
    if (inflight) return inflight
    inflight = fetcher()
      .then((res) => {
        if (res.ok) cache = { rows: res.rows, expiresAt: Date.now() + ttl }
        inflight = null
        return res
      })
      .catch((err) => {
        inflight = null
        throw err
      })
    return inflight
  }
}

// ─── Season-wide lists ────────────────────────────────────────────────────────

export const getCachedMeetings = makeSingleton<Meeting>(getMeetings, SESSION_TTL)
export const getCachedSessions = makeSingleton<Session>(getAllSessions, SESSION_TTL)

// getCachedLatestDrivers used to live here: a preloader-only warm-up that
// fetched a HARD-CODED session key (11247) with a scan fallback. Its only
// caller was SessionsPreloader, and once /drivers and /teams became static
// + ISR nothing read the cache it filled — so every visitor paid an openf1
// round trip on load to populate a map no page consumed. Removed.

// ─── Per-session data caches ──────────────────────────────────────────────────

export const getCachedWeather        = makeCache<Weather>(getWeather, DATA_TTL)
export const getCachedRaceControl    = makeCache<RaceControl>(getRaceControl, DATA_TTL)
export const getCachedLaps           = makeCache<Lap>(getLaps, DATA_TTL)
export const getCachedDrivers        = makeCache<Driver>(getDrivers, DATA_TTL)
export const getCachedPitStops       = makeCache<PitStop>(getPitStops, DATA_TTL)
export const getCachedPositions      = makeCache<Position>(getPositions, DATA_TTL)
export const getCachedStints         = makeCache<Stint>(getStints, DATA_TTL)
export const getCachedTeamRadio      = makeCache<TeamRadio>(getTeamRadio, DATA_TTL)
export const getCachedSessionResult  = makeCache<SessionResult>(getSessionResult, DATA_TTL)
