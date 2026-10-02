import { describe, expect, it } from 'vitest'
import { normalizeSessionResults } from '@/lib/openf1-normalize'
import { classifyResults, closestFinish, driverTrace, formatSessionTime, gridChanges, gridSessionFor, lastTimedStage, resultRows, sessionGap, sessionKind, teamPointsLeaders, timingValue } from '@/lib/results-story'
import type { Driver, PitStop, Position, SessionResult, StartingGrid, Session } from '@/lib/openf1'

const result = (over: Partial<SessionResult> = {}): SessionResult => ({
  driver_number: 1, position: 1, session_key: 7, meeting_key: 3, duration: 5000,
  gap_to_leader: 0, dnf: false, dns: false, dsq: false, points: 25, number_of_laps: 50, ...over,
})
const position = (number: number, place: number, date: string): Position => ({
  driver_number: number, position: place, date, session_key: 7, meeting_key: 3,
})
const grid = (number: number, place: number): StartingGrid => ({
  driver_number: number, position: place, session_key: 7, meeting_key: 3, lap_duration: 80,
})
const rows = (details: SessionResult[]) => resultRows(classifyResults(details, []), [])

describe('results session formats', () => {
  it('treats Sprint Qualifying and Shootout as qualifying, not a sprint race', () => {
    for (const name of ['Sprint Qualifying', 'Sprint Shootout', 'Qualifying']) {
      expect(sessionKind({ session_name: name, session_type: 'Qualifying' })).toBe('qualifying')
    }
    expect(sessionKind({ session_name: 'Sprint', session_type: 'Race' })).toBe('race')
    expect(sessionKind({ session_name: 'Practice 2', session_type: 'Practice' })).toBe('practice')
  })
  it('preserves null qualifying stages and separates qualifying seconds from lap deficits', () => {
    const { rows: normalized } = normalizeSessionResults([
      result({ duration: [93.267, 92.591, 91.835], gap_to_leader: [.056, .160, .011], position: 2 }),
      result({ driver_number: 2, duration: [95.312, null, null], gap_to_leader: [2.101, null, null], position: 17 }),
      result({ driver_number: 3, gap_to_leader: '+2 LAPS' }),
    ])
    expect(sessionGap(normalized[0], 'qualifying')).toBe('+0.011s')
    expect(sessionGap(normalized[0], 'qualifying', 0)).toBe('+0.056s')
    expect(formatSessionTime(timingValue(normalized[0].duration))).toBe('1:31.835')
    expect(normalized[1].duration).toEqual([95.312, null, null])
    expect(lastTimedStage(normalized[1])).toBe(0)
    expect(sessionGap(normalized[1], 'qualifying', 2)).toBe('—')
    expect(timingValue(normalized[1].duration, 2)).toBeNull()
    expect(sessionGap(normalized[2], 'race')).toBe('+2 LAPS')
  })
  it('keeps an absent points field distinct from a confirmed zero', () => {
    const { rows: normalized } = normalizeSessionResults([
      { ...result(), points: undefined }, result({ driver_number: 2, points: 0 }),
    ])
    expect(normalized[0].points_available).toBe(false)
    expect(normalized[1].points_available).toBe(true)
  })
  it('rounds the whole lap before splitting into minutes', () => {
    expect(formatSessionTime(119.9999)).toBe('2:00.000')
    expect(formatSessionTime(6675.281)).toBe('1:51:15.281')
    expect(formatSessionTime(null)).toBe('—')
    expect(formatSessionTime(0)).toBe('—')
  })
  it('preserves DSQ / DNS / DNF / NC outcomes', () => {
    expect(sessionGap(result({ dnf: true, dsq: true }), 'race')).toBe('DSQ')
    expect(sessionGap(result({ dns: true }), 'race')).toBe('DNS')
    expect(sessionGap(result({ dnf: true }), 'race')).toBe('DNF')
    expect(sessionGap(result({ position: null }), 'race')).toBe('NC')
  })
})

describe('published classification and grid story', () => {
  it('matches the race and sprint to their separate official grid publications', () => {
    const session = (key: number, name: string, date: string, meeting = 3) => ({ session_key: key, session_name: name, session_type: name, date_start: date, meeting_key: meeting }) as Session
    const sq = session(1, 'Sprint Qualifying', '2026-09-01T10:00:00Z')
    const sprint = session(2, 'Sprint', '2026-09-02T10:00:00Z')
    const quali = session(3, 'Qualifying', '2026-09-02T14:00:00Z')
    const race = session(4, 'Race', '2026-09-03T14:00:00Z')
    const sessions = [sq, sprint, quali, race, session(5, 'Qualifying', '2026-09-03T10:00:00Z', 8)]
    expect(gridSessionFor(race, sessions)?.session_key).toBe(3)
    expect(gridSessionFor(sprint, sessions)?.session_key).toBe(1)
    expect(gridSessionFor(race, [sq])).toBeNull()
    expect(gridSessionFor(sprint, [quali])).toBeNull()
  })
  it('uses published standings after penalties, including unclassified rows', () => {
    const classified = classifyResults([result({ driver_number: 2 }), result({ position: null, dsq: true })], [position(1, 1, '2026-09-01T14:00:00Z')])
    expect(classified.map((r) => [r.driver_number, r.position])).toEqual([[2, 1], [1, null]])
  })
  it('keeps a result even when its roster entry is missing', () => {
    const classified = resultRows(classifyResults([result({ driver_number: 77 })], []), [] as Driver[])
    expect(classified).toHaveLength(1)
    expect(classified[0].driver.full_name).toBe('Driver 77')
    expect(classified[0].driver.name_acronym).toBe('')
  })
  it('falls back to the latest timestamp per driver, ignoring malformed positions', () => {
    const classified = classifyResults([], [
      position(1, 3, '2026-09-01T14:00:00Z'), position(1, 2, '2026-09-01T13:00:00Z'),
      position(2, 1, 'bad date'), position(2, 0, '2026-09-01T14:00:00Z'),
    ])
    expect(classified).toEqual([{ driver_number: 1, position: 3, detail: null }])
  })
  it('only computes grid gains with an actual grid position and a classified finish', () => {
    const classified = rows([
      result({ position: 2 }), result({ driver_number: 2, position: 3, dnf: true }),
      result({ driver_number: 3, position: 4 }), result({ driver_number: 4, position: 5 }),
    ])
    const changes = gridChanges(classified, [grid(1, 7), grid(2, 5), grid(3, 0)])
    expect(changes.map((r) => [r.driver_number, r.gain])).toEqual([[1, 5]])
  })
  it('finds the closest consecutive finish in seconds, excluding lapped cars', () => {
    const classified = rows([
      result(), result({ driver_number: 2, position: 2, gap_to_leader: 3.5 }),
      result({ driver_number: 3, position: 3, gap_to_leader: 3.621 }),
      result({ driver_number: 4, position: 4, gap_to_leader: '+1 LAP' }),
    ])
    expect(closestFinish(classified)?.seconds).toBeCloseTo(.121)
    expect(closestFinish(classified)?.second.driver_number).toBe(3)
  })
  it('does not bridge a missing place in a closest-finish claim', () => {
    expect(closestFinish(rows([result(), result({ driver_number: 2, position: 3, gap_to_leader: .1 })]))).toBeNull()
  })
  it('shares the team-points highlight when two constructors tie', () => {
    const classified = rows([result(), result({ driver_number: 2, points: 8 }), result({ driver_number: 3, points: 18 }), result({ driver_number: 4, points: 15 })])
      .map((r, i) => ({ ...r, driver: { ...r.driver, team_name: i < 2 ? 'McLaren' : 'Mercedes' } }))
    expect(teamPointsLeaders(classified)).toEqual({ names: ['McLaren', 'Mercedes'], points: 33 })
    classified[0].detail!.points_available = false
    expect(teamPointsLeaders(classified)).toBeNull()
  })
  it('plots recorded race timing and only places stops within its observed window', () => {
    const trace = driverTrace([
      position(1, 4, '2026-09-01T14:10:00Z'), position(1, 7, '2026-09-01T14:00:00Z'),
      position(2, 1, '2026-09-01T14:00:00Z'),
    ], [
      { driver_number: 1, date: '2026-09-01T14:05:00Z', lap_number: 3 } as PitStop,
      { driver_number: 1, date: '2026-09-01T14:15:00Z', lap_number: 8 } as PitStop,
    ], 1)
    expect(trace?.points).toEqual([{ x: 0, position: 7 }, { x: 1, position: 4 }])
    expect(trace?.pits).toEqual([{ x: .5, lap: 3 }])
    expect(trace?.minutes).toBe(10)
  })
})
