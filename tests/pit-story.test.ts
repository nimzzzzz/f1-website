import { describe, expect, it } from 'vitest'
import type { Driver, PitStop, Stint } from '../lib/openf1'
import { median, pitTeams, pitTime, pitTyres, pitVisits, pitWindows, rankVisits } from '../lib/pit-story'

const stop = (extra: Partial<PitStop> = {}): PitStop => ({ session_key: 7, meeting_key: 1, driver_number: 4, lap_number: 20, date: '2026-09-01T13:00:00Z', pit_duration: 24.5, lane_duration: 24.5, stop_duration: 2.3, pit_in_time: null, pit_out_time: null, ...extra })
const driver = (extra: Partial<Driver> = {}): Driver => ({ session_key: 7, meeting_key: 1, driver_number: 4, full_name: 'Lando NORRIS', first_name: 'Lando', last_name: 'Norris', name_acronym: 'NOR', team_name: 'McLaren', team_colour: 'FF8000', headshot_url: '', country_code: 'GBR', broadcast_name: 'L NORRIS', ...extra })
const stint = (extra: Partial<Stint> = {}): Stint => ({ session_key: 7, meeting_key: 1, driver_number: 4, stint_number: 1, lap_start: 1, lap_end: 20, compound: 'MEDIUM', tyre_age_at_start: 0, ...extra })

describe('pit timing integrity', () => {
  it('keeps stationary service separate from lane duration, preferring the new lane field', () => {
    const [v] = pitVisits([stop({ lane_duration: 25, pit_duration: 24 })], [driver()], 7)
    expect(v.lane).toBe(25); expect(v.stationary).toBe(2.3)
    expect(pitVisits([stop({ lane_duration: undefined, stop_duration: undefined })], [], 7)[0]).toMatchObject({ lane: 24.5, stationary: null })
  })
  it('never calls a lane-only record a stationary stop', () => {
    const visits = pitVisits([stop({ lane_duration: 1571.5, pit_duration: 1571.5, stop_duration: null })], [driver()], 7)
    expect(rankVisits(visits, 'stationary')).toEqual([])
    expect(visits[0].lane).toBe(1571.5)
    expect(pitTime(visits[0].lane)).toBe('26:11.50')
  })
  it('rejects invalid durations and impossible service longer than the lane visit', () => {
    for (const n of [0, -2, NaN, Infinity]) {
      const [v] = pitVisits([stop({ lane_duration: n, pit_duration: n, stop_duration: n })], [], 7)
      expect(v.lane).toBeNull(); expect(v.stationary).toBeNull()
    }
    expect(pitVisits([stop({ stop_duration: 30 })], [], 7)[0].stationary).toBeNull()
  })
  it('merges incomplete duplicates but preserves separate same-lap visits', () => {
    const visits = pitVisits([stop(), stop({ date: '2026-09-01T13:00:00.000+00:00', stop_duration: null }), stop({ date: '2026-09-01T13:01:00Z', stop_duration: 2.4 })], [], 7)
    expect(visits).toHaveLength(2)
    expect(visits.map(v => [v.ordinal, v.total, v.stationary])).toEqual([[1, 2, 2.3], [2, 2, 2.4]])
  })
  it('filters other sessions and never attaches a different-session roster', () => {
    const visits = pitVisits([stop(), stop({ session_key: 8 }), stop({ driver_number: 0 })], [driver({ session_key: 8 })], 7)
    expect(visits).toHaveLength(1)
    expect(visits[0]).toMatchObject({ surname: 'Driver 4', team: 'Team unavailable', color: '#b7b7b7' })
    expect(pitTeams(visits, 'lane')).toEqual([])
  })
  it('numbers each driver’s visits chronologically, independent of response order', () => {
    const visits = pitVisits([stop({ lap_number: 40, date: '2026-09-01T14:00:00Z' }), stop({ driver_number: 16 }), stop()], [], 7)
    expect(visits.filter(v => v.number === 4).map(v => [v.lap, v.ordinal, v.total])).toEqual([[20, 1, 2], [40, 2, 2]])
  })
  it('rounds before splitting minutes and retains missing values', () => {
    expect(pitTime(59.999)).toBe('1:00.00')
    expect(pitTime(12.34, true)).toBe('0:12.34')
    for (const n of [null, undefined, NaN, 0, -1]) expect(pitTime(n)).toBe('N/A')
  })
})

describe('pit comparisons and tyre boundaries', () => {
  it('ranks using the selected measurement, with missing times excluded', () => {
    const visits = pitVisits([stop(), stop({ driver_number: 16, lane_duration: 23, stop_duration: 2.9 }), stop({ driver_number: 44, stop_duration: null })], [], 7)
    expect(rankVisits(visits, 'stationary').map(v => v.number)).toEqual([4, 16])
    expect(rankVisits(visits, 'lane')[0].number).toBe(16)
  })
  it('uses medians and reports timed coverage without dropping long visits', () => {
    const visits = pitVisits([stop(), stop({ date: '2026-09-01T14:00:00Z', lap_number: 40, lane_duration: 1600, stop_duration: null })], [driver()], 7)
    expect(pitTeams(visits, 'stationary')[0]).toMatchObject({ median: 2.3, timed: 1, count: 2 })
    expect(pitTeams(visits, 'lane')[0]).toMatchObject({ median: 812.25, worst: 1600 })
    expect(median([])).toBeNull(); expect(median([1, 4, 2])).toBe(2)
  })
  it('bins every known-lap visit once, includes empty windows and stops at the last visit', () => {
    const visits = pitVisits([stop({ lap_number: 2 }), stop({ driver_number: 16, lap_number: 21 }), stop({ driver_number: 44, lap_number: 21 }), stop({ driver_number: 12, lap_number: 0 })], [], 7)
    const windows = pitWindows(visits)
    expect(windows.map(w => w.visits.length)).toEqual([1, 0, 0, 0, 2])
    expect(windows.at(-1)).toMatchObject({ start: 21, end: 21 })
    expect(pitWindows([])).toEqual([])
  })
  it('only associates tyres across the exact same-session, same-driver boundary', () => {
    const [v] = pitVisits([stop()], [], 7)
    const after = stint({ stint_number: 2, lap_start: 21, lap_end: 50, compound: 'HARD' })
    expect(pitTyres(v, [stint(), after])?.after.compound).toBe('HARD')
    expect(pitTyres(v, [stint(), { ...after, lap_start: 25 }])).toBeNull()
    expect(pitTyres(v, [stint(), { ...after, session_key: 8 }])).toBeNull()
    expect(pitTyres(v, [stint(), { ...after, driver_number: 16 }])).toBeNull()
    expect(pitTyres(v, null)).toBeNull()
  })
})
