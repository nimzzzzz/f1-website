import { describe, expect, it } from 'vitest'
import type { Driver, Lap, PitStop, Stint } from '@/lib/openf1'
import { idealLap, lapDrivers, lapTime, pacePath, paceWindow, pitOnLap, prepareLaps, sectorDuel, stintAt, timedLaps, tyreAge } from '@/lib/laps-story'

const lap = (over: Partial<Lap> = {}): Lap => ({ meeting_key: 3, session_key: 7, driver_number: 4, lap_number: 1,
  date_start: '2026-09-12T14:00:00Z', lap_duration: 90, duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 30,
  is_pit_out_lap: false, i1_speed: null, i2_speed: null, st_speed: null, segments_sector_1: null, segments_sector_2: null, segments_sector_3: null, ...over })

describe('lap timing integrity', () => {
  it('retains out and untimed laps for the log, while rejecting non-finite times from best-lap calculations', () => {
    const prepared = prepareLaps([lap({ lap_number: 0 }), lap({ lap_duration: NaN }), lap({ lap_number: 2, lap_duration: Infinity }),
      lap({ lap_number: 3, lap_duration: 0 }), lap({ lap_number: 4, lap_duration: 65, is_pit_out_lap: true }), lap({ lap_number: 5, lap_duration: 91 })])
    expect(prepared).toHaveLength(5)
    expect(timedLaps(prepared).map((l) => l.lap_number)).toEqual([5])
  })
  it('keeps complete duplicate timing when a partial record follows it', () => {
    const prepared = prepareLaps([lap({ lap_number: 2 }), lap(), lap({ lap_duration: null, duration_sector_3: null })])
    expect(prepared).toHaveLength(2)
    expect(prepared[0].lap_duration).toBe(90)
    expect(prepared[0].duration_sector_3).toBe(30)
  })
  it('ranks one best lap per driver and retains drivers absent from the roster', () => {
    const drivers = lapDrivers(prepareLaps([lap(), lap({ lap_number: 2, lap_duration: 89 }), lap({ driver_number: 12, lap_duration: 90.1 })]), [] as Driver[])
    expect(drivers.map((d) => d.number)).toEqual([4, 12])
    expect(drivers[0].best.lap_number).toBe(2)
    expect(drivers[1].name).toBe('Driver 12')
  })
  it('reconstructs the Madrid duel at the recorded sector boundaries', () => {
    const a = lap({ lap_duration: 91.824, duration_sector_1: 28.226, duration_sector_2: 32.797, duration_sector_3: 30.801 })
    const b = lap({ driver_number: 12, lap_duration: 91.835, duration_sector_1: 28.315, duration_sector_2: 32.999, duration_sector_3: 30.521 })
    const splits = sectorDuel(a, b)
    expect(splits[0].gap).toBeCloseTo(.089, 5)
    expect(splits[1].gap).toBeCloseTo(.291, 5)
    expect(splits[2].gap).toBeCloseTo(.011, 5)
  })
  it('does not bridge missing cumulative sectors with an invented gap', () => {
    const splits = sectorDuel(lap({ duration_sector_1: null }), lap())
    expect(splits.map((s) => s.gap)).toEqual([null, null, null])
    expect(splits[2].a).toBe(30)
  })
  it('builds the ideal from distinct personal sectors and excludes out laps', () => {
    const ideal = idealLap([lap(), lap({ lap_number: 2, lap_duration: 91, duration_sector_1: 29, duration_sector_2: 31, duration_sector_3: 31 }),
      lap({ lap_number: 3, lap_duration: 90.5, duration_sector_1: 31, duration_sector_2: 29, duration_sector_3: 30.5 }),
      lap({ lap_number: 4, lap_duration: 60, duration_sector_1: 20, duration_sector_2: 20, duration_sector_3: 20, is_pit_out_lap: true })])
    expect(ideal?.total).toBe(88)
    expect(ideal?.gain).toBe(2)
    expect(ideal?.parts.map((l) => l.lap_number)).toEqual([2, 3, 1])
  })
  it('withholds a theoretical time when unavailable best-lap sectors would imply a negative gain', () => {
    expect(idealLap([lap({ lap_duration: 85, duration_sector_1: null, duration_sector_2: null, duration_sector_3: null }), lap({ lap_number: 2 })])).toBeNull()
    expect(idealLap([lap({ duration_sector_1: null })])).toBeNull()
  })
  it('rounds milliseconds before splitting minutes and never formats unknown timing as zero', () => {
    expect(lapTime(119.9999)).toBe('2:00.000')
    for (const value of [null, undefined, NaN, Infinity, 0, -1]) expect(lapTime(value)).toBe('N/A')
  })
})

describe('pace and tyre context', () => {
  const stint: Stint = { session_key: 7, meeting_key: 3, driver_number: 4, stint_number: 2, compound: 'HARD', lap_start: 10, lap_end: 20, tyre_age_at_start: 3 }
  it('joins stints on driver, session and inclusive lap range, reporting age at lap start', () => {
    expect(stintAt(lap({ lap_number: 10 }), [stint])).toEqual(stint)
    expect(stintAt(lap({ lap_number: 20 }), [stint])).toEqual(stint)
    expect(tyreAge(lap({ lap_number: 13 }), stint)).toBe(6)
    expect(stintAt(lap({ lap_number: 21 }), [stint])).toBeNull()
    expect(stintAt(lap({ lap_number: 13, session_key: 8 }), [stint])).toBeNull()
    expect(stintAt(lap({ lap_number: 13, driver_number: 12 }), [stint])).toBeNull()
    expect(tyreAge(lap(), null)).toBeNull()
  })
  it('only associates pit markers with the matching session, driver and lap', () => {
    const stop = { session_key: 7, driver_number: 4, lap_number: 10 } as PitStop
    expect(pitOnLap(lap({ lap_number: 10 }), [stop])).toBe(true)
    expect(pitOnLap(lap({ lap_number: 10, session_key: 8 }), [stop])).toBe(false)
    expect(pitOnLap(lap({ lap_number: 11 }), [stop])).toBe(false)
  })
  it('counts focus exclusions per driver without deleting them from the lap log', () => {
    const laps = prepareLaps([lap(), lap({ lap_number: 2, lap_duration: 130 }), lap({ lap_number: 3, is_pit_out_lap: true, lap_duration: 140 }), lap({ lap_number: 4, lap_duration: 91 })])
    const drivers = lapDrivers(laps, [])
    const focus = paceWindow(drivers, true)
    expect(focus.hidden).toBe(1)
    expect(focus.lastLap).toBe(4)
    expect(focus.visible.map((l) => l.lap_number)).toEqual([1, 4])
    expect(paceWindow(drivers, false).visible).toHaveLength(3)
    expect(drivers[0].laps).toHaveLength(4)
  })
  it('breaks graph paths at missing laps instead of inventing connecting pace', () => {
    const path = pacePath(timedLaps([lap(), lap({ lap_number: 2 }), lap({ lap_number: 4 })]), (n) => n, (n) => n)
    expect(path).toBe('M1.00,90.00 L2.00,90.00 M4.00,90.00')
  })
})
