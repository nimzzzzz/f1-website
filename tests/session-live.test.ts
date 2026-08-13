import { describe, it, expect } from 'vitest'
import {
  isSessionLive,
  isSessionRunning,
  msUntilLiveChange,
  LIVE_LEAD_MS,
  LIVE_TAIL_MS,
  POLL_FAST,
  POLL_MEDIUM,
  POLL_SLOW,
} from '@/lib/session-live'
import { ENDPOINT_TTL, ttlFor } from '@/lib/openf1-proxy-policy'

const session = (startISO: string, endISO: string) =>
  ({ session_key: 1, date_start: startISO, date_end: endISO }) as never

// A 2h race window.
const START = Date.parse('2026-08-23T13:00:00Z')
const END = Date.parse('2026-08-23T15:00:00Z')
const s = session('2026-08-23T13:00:00Z', '2026-08-23T15:00:00Z')

describe('the live window is decided by the calendar, not by the data', () => {
  it('is live during the scheduled session', () => {
    expect(isSessionLive(s, START + 60_000)).toBe(true)
    expect(isSessionLive(s, END - 60_000)).toBe(true)
  })

  it('opens BEFORE lights out, for formation and pre-session race control', () => {
    expect(isSessionLive(s, START - LIVE_LEAD_MS + 1000)).toBe(true)
    expect(isSessionLive(s, START - LIVE_LEAD_MS - 1000)).toBe(false)
  })

  it('stays open AFTER the scheduled flag', () => {
    // Scheduled end is not actual end: red flags overrun, and the final
    // classification lands minutes after the chequered flag. A page that
    // stopped at the scheduled end would freeze mid-order and never reach
    // the result — the most visible version of the bug this batch kills.
    expect(isSessionLive(s, END + 60_000)).toBe(true)
    expect(isSessionLive(s, END + LIVE_TAIL_MS - 1000)).toBe(true)
    expect(isSessionLive(s, END + LIVE_TAIL_MS + 1000)).toBe(false)
  })

  it('is not live long before or long after', () => {
    expect(isSessionLive(s, START - 24 * 3600_000)).toBe(false)
    expect(isSessionLive(s, END + 24 * 3600_000)).toBe(false)
  })

  it('handles a missing or malformed session without throwing', () => {
    expect(isSessionLive(null)).toBe(false)
    expect(isSessionLive(undefined)).toBe(false)
    expect(isSessionLive(session('not-a-date', 'nope'))).toBe(false)
  })

  it('RUNNING is narrower than LIVE — no lead, no tail', () => {
    // The picker's dot and NowSection answer "is it running"; polling asks
    // the wider "should we be listening".
    expect(isSessionRunning(s, START - 60_000)).toBe(false)
    expect(isSessionLive(s, START - 60_000)).toBe(true)
    expect(isSessionRunning(s, END + 60_000)).toBe(false)
    expect(isSessionLive(s, END + 60_000)).toBe(true)
  })
})

describe('the window boundary is scheduled, not polled for', () => {
  it('reports the wait until the window opens', () => {
    const now = START - LIVE_LEAD_MS - 30_000
    expect(msUntilLiveChange(s, now)).toBe(30_000)
  })

  it('reports the wait until the window closes', () => {
    const now = END + LIVE_TAIL_MS - 45_000
    expect(msUntilLiveChange(s, now)).toBe(45_000)
  })

  it('reports no further transition once the window has passed', () => {
    expect(msUntilLiveChange(s, END + LIVE_TAIL_MS + 1)).toBeNull()
    expect(msUntilLiveChange(null)).toBeNull()
  })
})

describe('poll intervals cannot outrun the cache that serves them', () => {
  // Polling faster than the proxy TTL returns byte-identical responses, so
  // every interval must sit at or above its endpoint's TTL. This is the
  // check that keeps someone "tuning" an interval down to 5s and quietly
  // tripling request volume for data that provably cannot have changed.
  const PAIRS: [string, number][] = [
    ['race_control', POLL_FAST],
    ['position', POLL_FAST],
    ['laps', POLL_MEDIUM],
    ['pit', POLL_MEDIUM],
    ['stints', POLL_SLOW],
    ['weather', POLL_SLOW],
    ['session_result', POLL_SLOW],
  ]

  it('every poll interval is >= its endpoint TTL', () => {
    for (const [endpoint, interval] of PAIRS) {
      expect(interval).toBeGreaterThanOrEqual(ttlFor(endpoint) * 1000)
    }
  })

  it('the fast tier is genuinely faster than the slow tier', () => {
    expect(POLL_FAST).toBeLessThan(POLL_MEDIUM)
    expect(POLL_MEDIUM).toBeLessThan(POLL_SLOW)
  })

  it('the roster is not on any polling tier', () => {
    // drivers is fixed for a session; polling it during a race is pure cost.
    expect(PAIRS.map(([e]) => e)).not.toContain('drivers')
  })

  it('bounds the upstream cost of one fully-watched live session', () => {
    // Because the proxy cache is SHARED, upstream cost depends on the TTLs
    // alone and not on how many people are watching. This pins the ceiling
    // so a future TTL change cannot quietly multiply race-day load.
    const live = ['race_control', 'position', 'laps', 'pit', 'stints', 'weather', 'session_result']
    const callsPerMin = live.reduce((sum, e) => sum + 60 / ttlFor(e), 0)
    expect(callsPerMin).toBeLessThanOrEqual(15)
  })

  it('only the endpoints that move during a session were lowered', () => {
    expect(ENDPOINT_TTL.race_control).toBeLessThan(60)
    expect(ENDPOINT_TTL.position).toBeLessThan(60)
    expect(ENDPOINT_TTL.drivers).toBe(60)
    expect(ENDPOINT_TTL.meetings).toBe(60)
    expect(ttlFor('unknown-endpoint')).toBe(60)
  })
})
