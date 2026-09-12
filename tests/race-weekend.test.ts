import { describe, expect, it } from 'vitest'
import type { Session } from '../lib/openf1'
import { countdownParts, weekendSessions, weekendState } from '../lib/race-weekend'

const session = (key: number, start: string, end: string, extra: Partial<Session> = {}): Session => ({
  session_key: key, meeting_key: 1294, session_name: 'Practice 1', session_type: 'Practice',
  date_start: start, date_end: end, circuit_short_name: 'Madring', country_code: 'ESP',
  country_name: 'Spain', location: 'Madrid', gmt_offset: '02:00:00', year: 2026, ...extra,
})
const fp = session(1, '2026-09-11T10:00:00Z', '2026-09-11T11:00:00Z')
const qualifying = session(2, '2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z', { session_name: 'Qualifying' })

describe('homepage race weekend', () => {
  it('sorts the selected weekend without mutating the calendar or including cancelled sessions', () => {
    const input = [qualifying, { ...fp, session_key: 3, meeting_key: 999 }, { ...fp, session_key: 4, is_cancelled: true }, fp]
    expect(weekendSessions(input, 1294).map((s) => s.session_key)).toEqual([1, 2])
    expect(input[0]).toBe(qualifying)
  })
  it('switches from countdown to live at the exact start time', () => {
    expect(weekendState([qualifying, fp], Date.parse(fp.date_start))).toEqual({ live: fp, next: qualifying })
  })
  it('advances to qualifying at the end of practice', () => {
    expect(weekendState([fp, qualifying], Date.parse(fp.date_end))).toEqual({ live: null, next: qualifying })
  })
  it('does not keep a cancelled session live', () => {
    expect(weekendState([{ ...fp, is_cancelled: true }], Date.parse(fp.date_start))).toEqual({ live: null, next: null })
  })
  it('ends cleanly after the last session and with no schedule', () => {
    expect(weekendState([fp, qualifying], Date.parse(qualifying.date_end))).toEqual({ live: null, next: null })
    expect(weekendState([], Date.now())).toEqual({ live: null, next: null })
  })
  it('counts down across day boundaries and clamps elapsed targets to zero', () => {
    expect(countdownParts('2026-09-12T14:00:00Z', Date.parse('2026-09-11T11:56:56Z'))).toEqual([1, 2, 3, 4])
    expect(countdownParts(fp.date_start, Date.parse(fp.date_end))).toEqual([0, 0, 0, 0])
  })
})
