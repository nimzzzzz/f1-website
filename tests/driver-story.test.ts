import { describe, expect, it } from 'vitest'
import { toDriverSeason, toGalleryDrivers } from '../lib/season-view'
import { featuredSeasonStation, latestEnteredStation, resultLabel, seasonFieldSize } from '../lib/driver-story'
import type { Meeting } from '../lib/openf1'
import type { SeasonBundle, BundleDriverStanding } from '../lib/season-data'

const meeting = (key: number, extra: Partial<Meeting> = {}): Meeting => ({
  meeting_key: key, meeting_name: `Round ${key} Grand Prix`, meeting_official_name: '', location: '',
  country_code: 'GBR', country_name: 'UK', country_flag: '', circuit_short_name: `Circuit ${key}`,
  circuit_type: 'Permanent', circuit_image: '', gmt_offset: '00:00:00',
  date_start: `2026-06-${String(key).padStart(2, '0')}T12:00:00Z`, date_end: `2026-06-${String(key).padStart(2, '0')}T14:00:00Z`, year: 2026, ...extra,
})
const driver = (number: number, extra: Partial<BundleDriverStanding> = {}): BundleDriverStanding => ({
  driverNumber: number, position: number, nameAcronym: number === 1 ? 'AAA' : 'BBB', fullName: 'A Driver',
  firstName: 'A', surname: 'Driver', teamName: 'Team A', teamColour: 'EEEEEE', countryCode: 'GBR', points: 40.5, wins: 1, podiums: 1, ...extra,
})
const bundle = (): SeasonBundle => ({
  blocked: false, complete: true, computedAt: '2026-09-12T12:00:00Z', seasonYear: 2026, completedRaces: 5,
  driverStandings: [driver(1), driver(2, { points: 90 })], teamStandings: [], lastRace: null, winnersByRound: {},
  meetings: [meeting(6), meeting(1), meeting(2), meeting(3), meeting(4), meeting(5)], sessions: [],
  resultsByRound: {
    1: [{ d: 1, p: 1, pts: 12.5 }, { d: 2, p: 2, pts: 9 }],
    2: [{ d: 1, p: null, pts: 0, out: 1, st: 'DNS' }, { d: 2, p: 1, pts: 25 }],
    3: [{ d: 2, p: 1, pts: 25 }],
    4: [{ d: 1, p: 22, pts: 0 }, { d: 2, p: 20, pts: 0 }],
    5: [{ d: 1, p: 1, pts: 25 }, { d: 2, p: 2, pts: 18 }],
  },
  sprintPointsByRound: { 1: { 1: 3 } },
})

describe('driver season stories', () => {
  it('preserves fractional season points and keeps sprint points separate from the GP', () => {
    const view = toDriverSeason(bundle(), 'aaa')!
    expect(view.driver.points).toBe(40.5)
    expect(view.stations[0].points).toBe(12.5)
    expect(view.stations[0].sprintPoints).toBe(3)
    expect(toGalleryDrivers(bundle())[0].points).toBe(40.5)
  })
  it('does not turn absences or DNS into a retirement, finish or highlight', () => {
    const view = toDriverSeason(bundle(), 'AAA')!
    expect(view.stations.map(resultLabel)).toEqual(['P1', 'DNS', 'NO ENTRY', 'P22', 'P1', 'UPCOMING'])
    expect(view.dnfs).toBe(0)
    expect(latestEnteredStation(view.stations)?.round).toBe(5)
    expect(featuredSeasonStation(view.stations)?.round).toBe(1)
  })
  it('compares GP points only on shared entries and counts only both-classified head-to-heads', () => {
    const duel = toDriverSeason(bundle(), 'AAA')!.duel!
    expect(duel.rounds.map((r) => r.round)).toEqual([1, 2, 4, 5])
    expect(duel.myPoints).toBe(37.5)
    expect(duel.theirPoints).toBe(52)
    expect(duel.bothClassified).toBe(3)
    expect([duel.raceWins, duel.raceLosses]).toEqual([2, 1])
    expect(duel.rounds[1].winner).toBe('unclassified')
  })
  it('never counts a tied classified position as a loss', () => {
    const input = bundle()
    input.resultsByRound[1][1].p = 1
    const duel = toDriverSeason(input, 'AAA')!.duel!
    expect(duel.rounds[0].winner).toBe('tie')
    expect([duel.raceWins, duel.raceLosses]).toEqual([1, 1])
  })
  it('scales beyond P20 and excludes cancelled races even when stale results exist', () => {
    const input = bundle()
    input.meetings.find((m) => m.meeting_key === 1)!.is_cancelled = true
    const view = toDriverSeason(input, 'AAA')!
    expect(seasonFieldSize(view.stations)).toBe(22)
    expect(resultLabel(view.stations[0])).toBe('CANCELLED')
    expect(featuredSeasonStation(view.stations)?.round).toBe(5)
    expect(view.duel!.rounds.map((r) => r.round)).not.toContain(1)
  })
  it('shows a substitute’s actual recent entries instead of five artificial zero results', () => {
    const form = toGalleryDrivers(bundle())[0].recentForm
    expect(form.map((r) => r.round)).toEqual([1, 2, 4, 5])
    const input = bundle()
    input.resultsByRound = { 5: [{ d: 1, p: 10, pts: 1 }] }
    expect(toGalleryDrivers(input)[0].recentForm.map(resultLabel)).toEqual(['P10'])
    expect(toDriverSeason(input, 'AAA')!.duel!.rounds).toEqual([])
  })
  it('handles no results and unknown drivers without invented highlights', () => {
    const input = bundle()
    input.resultsByRound = {}
    const view = toDriverSeason(input, 'AAA')!
    expect(featuredSeasonStation(view.stations)).toBeNull()
    expect(latestEnteredStation(view.stations)?.round).toBe(1)
    expect(toDriverSeason(input, 'ZZZ')).toBeNull()
    expect(toGalleryDrivers(input)[0].recentForm).toEqual([])
  })
})
