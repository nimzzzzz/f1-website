import { describe, it, expect } from 'vitest'
import {
  isCancelled,
  cancelledMeetingKeys,
  activeMeetings,
  activeSessions,
  CANCELLED_MEETING_KEYS,
  type Meeting,
  type Session,
} from '@/lib/openf1'

// The bug these tests exist to prevent:
//
// Cancellation used to be decided by country name — CANCELLED_COUNTRIES =
// {'Bahrain', 'Saudi Arabia'}. That silently deleted the REPLACEMENT Bahrain
// Grand Prix (meeting 1308), a real, not-cancelled race held in Kuala Lumpur
// that still carries country_name "Bahrain", from the schedule, the
// countdown and every season calculation. Anything here that starts matching
// on country_name again is the regression coming back.

const meeting = (over: Partial<Meeting> & { meeting_key: number }): Meeting =>
  ({
    meeting_name: 'Grand Prix',
    meeting_official_name: 'Grand Prix',
    location: 'Somewhere',
    country_code: 'XX',
    country_name: 'Nowhere',
    country_flag: '',
    circuit_short_name: 'Circuit',
    circuit_type: '',
    circuit_image: '',
    gmt_offset: '00:00:00',
    date_start: '2026-01-01T00:00:00+00:00',
    date_end: '2026-01-02T00:00:00+00:00',
    year: 2026,
    ...over,
  }) as Meeting

const session = (over: Partial<Session> & { session_key: number; meeting_key: number }): Session =>
  ({
    session_type: 'Race',
    session_name: 'Race',
    date_start: '2026-01-01T00:00:00+00:00',
    date_end: '2026-01-01T02:00:00+00:00',
    circuit_short_name: 'Circuit',
    country_code: 'XX',
    country_name: 'Nowhere',
    location: 'Somewhere',
    gmt_offset: '00:00:00',
    year: 2026,
    ...over,
  }) as Session

// The three 2026 meetings at the heart of the bug, with real keys.
const SAKHIR = meeting({ meeting_key: 1282, country_name: 'Bahrain', location: 'Sakhir', is_cancelled: true })
const JEDDAH = meeting({ meeting_key: 1283, country_name: 'Saudi Arabia', location: 'Jeddah', is_cancelled: true })
const KUALA_LUMPUR = meeting({
  meeting_key: 1308,
  country_name: 'Bahrain', // <- the collision that broke the old filter
  location: 'Kuala Lumpur',
  meeting_name: 'Bahrain Grand Prix',
  is_cancelled: false,
})
const HUNGARY = meeting({ meeting_key: 1291, country_name: 'Hungary', location: 'Budapest', is_cancelled: false })

describe('isCancelled', () => {
  it('excludes the original Bahrain round (1282)', () => {
    expect(isCancelled(SAKHIR)).toBe(true)
  })

  it('excludes the original Saudi round (1283)', () => {
    expect(isCancelled(JEDDAH)).toBe(true)
  })

  it('INCLUDES the Kuala Lumpur replacement (1308) despite country_name "Bahrain"', () => {
    expect(isCancelled(KUALA_LUMPUR)).toBe(false)
  })

  it('includes an ordinary round', () => {
    expect(isCancelled(HUNGARY)).toBe(false)
  })

  it('falls back to meeting keys when upstream omits is_cancelled', () => {
    const noField = meeting({ meeting_key: 1282, country_name: 'Bahrain' })
    delete (noField as { is_cancelled?: boolean }).is_cancelled
    expect(isCancelled(noField)).toBe(true)

    const replacementNoField = meeting({ meeting_key: 1308, country_name: 'Bahrain' })
    delete (replacementNoField as { is_cancelled?: boolean }).is_cancelled
    // the fallback is keyed by MEETING, so the replacement survives it
    expect(isCancelled(replacementNoField)).toBe(false)
  })

  it('trusts an explicit upstream false over the static fallback set', () => {
    // if F1 ever reinstates a round, upstream flipping the flag is enough
    expect(isCancelled(meeting({ meeting_key: 1282, is_cancelled: false }))).toBe(false)
  })
})

describe('country-name collision regression', () => {
  const calendar = [SAKHIR, JEDDAH, KUALA_LUMPUR, HUNGARY]

  it('keeps the replacement while dropping the cancelled rounds', () => {
    const active = activeMeetings(calendar)
    const keys = active.map((m) => m.meeting_key)
    expect(keys).toContain(1308)
    expect(keys).not.toContain(1282)
    expect(keys).not.toContain(1283)
    expect(active).toHaveLength(2)
  })

  it('never filters on country_name: Bahrain appears both cancelled and active', () => {
    const bahrain = calendar.filter((m) => m.country_name === 'Bahrain')
    expect(bahrain).toHaveLength(2)
    // a country-based filter would remove both; a meeting-based one removes one
    expect(activeMeetings(bahrain).map((m) => m.meeting_key)).toEqual([1308])
  })

  it('cancelledMeetingKeys resolves upstream flags plus the static fallback', () => {
    const keys = cancelledMeetingKeys(calendar)
    expect(keys.has(1282)).toBe(true)
    expect(keys.has(1283)).toBe(true)
    expect(keys.has(1308)).toBe(false)
  })

  it('the static fallback set contains only meeting keys, never country names', () => {
    for (const k of CANCELLED_MEETING_KEYS) expect(typeof k).toBe('number')
  })
})

describe('activeSessions', () => {
  const sessions = [
    session({ session_key: 1, meeting_key: 1282, country_name: 'Bahrain', is_cancelled: true }),
    session({ session_key: 2, meeting_key: 1283, country_name: 'Saudi Arabia', is_cancelled: true }),
    session({ session_key: 3, meeting_key: 1308, country_name: 'Bahrain', is_cancelled: false }),
    session({ session_key: 4, meeting_key: 1291, country_name: 'Hungary', is_cancelled: false }),
  ]

  it('keeps the replacement round’s sessions and drops the cancelled ones', () => {
    const keys = activeSessions(sessions).map((s) => s.session_key)
    expect(keys).toEqual([3, 4])
  })

  it('resolves a session through its meeting when its own flag is missing', () => {
    const partial = session({ session_key: 9, meeting_key: 1282, country_name: 'Bahrain' })
    delete (partial as { is_cancelled?: boolean }).is_cancelled
    expect(activeSessions([partial])).toHaveLength(0)
  })

  it('honours a caller-supplied cancelled-key set', () => {
    const keys = new Set([1291])
    const out = activeSessions(sessions, keys).map((s) => s.session_key)
    expect(out).not.toContain(4)
    expect(out).toContain(3)
  })
})
