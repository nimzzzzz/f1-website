import { describe, expect, it } from 'vitest'
import { toTeamMachine } from '../lib/season-view'
import { latestTeamWeekend, weekendDriverPoints } from '../lib/team-story'
import type { Meeting } from '../lib/openf1'
import type { BundleDriverStanding, SeasonBundle } from '../lib/season-data'

const meeting = (key: number, extra: Partial<Meeting> = {}): Meeting => ({
  meeting_key: key, meeting_name: `Round ${key} Grand Prix`, meeting_official_name: '', location: '',
  country_code: 'GBR', country_name: 'UK', country_flag: '', circuit_short_name: `Circuit ${key}`,
  circuit_type: 'Permanent', circuit_image: '', gmt_offset: '00:00:00',
  date_start: `2026-06-${String(key).padStart(2, '0')}T12:00:00Z`, date_end: `2026-06-${String(key).padStart(2, '0')}T14:00:00Z`, year: 2026, ...extra,
})
const driver = (n: number, extra: Partial<BundleDriverStanding> = {}): BundleDriverStanding => ({
  driverNumber: n, position: n, nameAcronym: `D${n}`, fullName: `Driver ${n}`, firstName: 'Driver', surname: String(n),
  teamName: 'Ferrari', teamColour: 'ED1C24', countryCode: 'GBR', points: n === 1 ? 100 : 80, wins: 1, podiums: 1, ...extra,
})
const bundle = (): SeasonBundle => ({
  blocked: false, complete: true, computedAt: '2026-09-12T12:00:00Z', seasonYear: 2026, completedRaces: 3,
  driverStandings: [driver(1), driver(2)],
  teamStandings: [{ position: 2, teamName: 'Ferrari', teamColour: 'ED1C24', points: 200, wins: 1, driverSurnames: ['1', '2'] }, { position: 1, teamName: 'Mercedes', teamColour: '00FFFF', points: 350, wins: 3, driverSurnames: [] }],
  lastRace: null, winnersByRound: {}, sessions: [],
  meetings: [meeting(5), meeting(1), meeting(2, { is_cancelled: true }), meeting(3), meeting(4)],
  resultsByRound: {
    1: [{ d: 1, p: 1, pts: 12.5 }, { d: 2, p: 2, pts: 9 }],
    2: [{ d: 1, p: 1, pts: 25 }, { d: 2, p: 2, pts: 18 }],
    3: [{ d: 1, p: null, pts: 0, out: 1, st: 'DNS' }, { d: 2, p: 22, pts: 0 }],
    4: [{ d: 1, p: 3, pts: 15 }],
  },
  sprintPointsByRound: { 1: { 1: 8, 2: 7 }, 2: { 1: 8 } },
})

describe('constructor pit wall', () => {
  it('keeps official calendar numbering and ignores stale results for cancelled rounds', () => {
    const view = toTeamMachine(bundle(), 'ferrari')!
    expect(view.weekends.map((w) => [w.round, w.status])).toEqual([[1, 'complete'], [2, 'cancelled'], [3, 'complete'], [4, 'complete'], [5, 'upcoming']])
    expect(weekendDriverPoints(view.weekends[1]).total).toBeNull()
    expect(view.season.biggestHaul).toEqual({ points: 36.5, circuit: 'Circuit 1', round: 1 })
    expect(latestTeamWeekend(view.weekends)?.round).toBe(4)
  })
  it('preserves fractional GP scores, includes sprint points exactly once and keeps constructor totals separate', () => {
    const view = toTeamMachine(bundle(), 'ferrari')!
    expect(weekendDriverPoints(view.weekends[0])).toEqual({ grandPrix: 21.5, sprint: 15, total: 36.5 })
    expect(view.season.points).toBe(200)
  })
  it('distinguishes P22, DNS, missing entries and races that have not happened', () => {
    const view = toTeamMachine(bundle(), 'ferrari')!
    expect(view.weekends[2].results[0].outLabel).toBe('DNS')
    expect(view.weekends[2].results[1]).toMatchObject({ status: 'finished', position: 22 })
    expect(view.weekends[3].results[1].status).toBe('absent')
    expect(weekendDriverPoints(view.weekends[2]).total).toBe(0)
    expect(weekendDriverPoints(view.weekends[4]).total).toBeNull()
    expect(view.season.dnfs).toBe(0)
  })
  it('does not turn a classified tie into a head-to-head win', () => {
    const data = bundle()
    data.resultsByRound[1][1].p = 1
    expect(toTeamMachine(data, 'ferrari')!.pairing).toEqual({ winsA: 0, winsB: 0, bothClassified: 1 })
  })
  it('keeps reserve drivers in the results without changing the main pairing', () => {
    const data = bundle()
    data.driverStandings.push(driver(3, { points: 2 }))
    data.resultsByRound[4].push({ d: 3, p: 9, pts: 2 })
    const view = toTeamMachine(data, 'ferrari')!
    expect(view.drivers.map((d) => d.number)).toEqual([1, 2, 3])
    expect(weekendDriverPoints(view.weekends[3]).total).toBe(17)
    expect(view.weekends[3].results[2]).toMatchObject({ driverNumber: 3, position: 9, points: 2 })
  })
  it('has useful pre-season and sprint-before-GP states', () => {
    const data = bundle()
    data.resultsByRound = {}
    data.sprintPointsByRound = {}
    const view = toTeamMachine(data, 'ferrari')!
    expect(latestTeamWeekend(view.weekends)?.round).toBe(1)
    expect(weekendDriverPoints(view.weekends[0]).total).toBeNull()
    data.sprintPointsByRound = { 1: { 1: 8, 2: 6 } }
    expect(weekendDriverPoints(toTeamMachine(data, 'ferrari')!.weekends[0])).toEqual({ grandPrix: 0, sprint: 14, total: 14 })
    expect(latestTeamWeekend([])).toBeNull()
  })
  it('wraps the next garage by constructor order, with no self-link for a single team', () => {
    const data = bundle()
    expect(toTeamMachine(data, 'ferrari')!.nextTeam?.slug).toBe('mercedes')
    data.teamStandings = data.teamStandings.slice(0, 1)
    expect(toTeamMachine(data, 'ferrari')!.nextTeam).toBeNull()
    expect(toTeamMachine(data, 'unknown')).toBeNull()
  })
})
