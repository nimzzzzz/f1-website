import type { Driver, Lap, PitStop, Stint } from './openf1'

export type TimedLap = Lap & { lap_duration: number }
export type LapDriver = { number: number; name: string; surname: string; acronym: string; team: string; color: string; best: TimedLap; laps: Lap[] }
export const sectors = ['duration_sector_1', 'duration_sector_2', 'duration_sector_3'] as const
export const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
export const lapKey = (lap: Pick<Lap, 'driver_number' | 'lap_number'>) => `${lap.driver_number}-${lap.lap_number}`

/** A partial timing update must not replace an already complete duplicate. */
export function prepareLaps(raw: Lap[]): Lap[] {
  const rows = new Map<string, Lap>()
  for (const lap of raw) {
    if (!Number.isInteger(lap.driver_number) || lap.driver_number <= 0 || !Number.isInteger(lap.lap_number) || lap.lap_number <= 0) continue
    const clean = { ...lap, lap_duration: positive(lap.lap_duration) ? lap.lap_duration : null }
    for (const key of sectors) clean[key] = positive(lap[key]) ? lap[key] : null
    const previous = rows.get(lapKey(clean))
    if (!previous || clean.lap_duration !== null || previous.lap_duration === null) rows.set(lapKey(clean), clean)
  }
  return [...rows.values()].sort((a, b) => a.lap_number - b.lap_number || a.driver_number - b.driver_number)
}

// "Timed" is intentionally not "clean": the lap feed does not flag deleted
// laps, in laps, traffic, fuel load, or every caution period.
export function timedLaps(laps: Lap[]): TimedLap[] {
  return laps.filter((lap): lap is TimedLap => positive(lap.lap_duration) && !lap.is_pit_out_lap)
}

export function lapDrivers(laps: Lap[], drivers: Driver[]): LapDriver[] {
  const roster = new Map(drivers.map((d) => [d.driver_number, d]))
  const grouped = new Map<number, Lap[]>()
  for (const lap of laps) grouped.set(lap.driver_number, [...(grouped.get(lap.driver_number) ?? []), lap])
  return [...grouped].flatMap(([number, rows]) => {
    const best = timedLaps(rows).sort((a, b) => a.lap_duration - b.lap_duration || a.lap_number - b.lap_number)[0]
    if (!best) return []
    const d = roster.get(number)
    return [{ number, name: d?.full_name || `Driver ${number}`, surname: d?.last_name || `Driver ${number}`,
      acronym: d?.name_acronym || String(number), team: d?.team_name || 'Team unavailable',
      color: /^[0-9a-f]{6}$/i.test(d?.team_colour ?? '') ? `#${d!.team_colour}` : '#b7b7b7', best, laps: rows }]
  }).sort((a, b) => a.best.lap_duration - b.best.lap_duration || a.number - b.number)
}

export function lapTime(seconds: number | null | undefined): string {
  if (!positive(seconds)) return 'N/A'
  const ms = Math.round(seconds * 1000)
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
export const sectorTime = (seconds: number | null | undefined) => positive(seconds) ? seconds.toFixed(3) : 'N/A'

/** Positive = A ahead. An absent split never invents a cumulative gap. */
export function sectorDuel(a: Lap, b: Lap) {
  let aTotal: number | null = 0, bTotal: number | null = 0
  return sectors.map((key) => {
    const av = a[key], bv = b[key]
    aTotal = aTotal !== null && positive(av) ? aTotal + av : null
    bTotal = bTotal !== null && positive(bv) ? bTotal + bv : null
    return { a: av, b: bv, aTotal, bTotal, gap: aTotal !== null && bTotal !== null ? bTotal - aTotal : null }
  })
}

export function idealLap(laps: Lap[]) {
  const timed = timedLaps(laps)
  const best = [...timed].sort((a, b) => a.lap_duration - b.lap_duration)[0]
  const parts = sectors.map((key) => [...timed].filter((l) => positive(l[key])).sort((a, b) => a[key]! - b[key]!)[0])
  if (!best || parts.some((l) => !l)) return null
  const total = parts.reduce((sum, lap, i) => sum + lap[sectors[i]]!, 0)
  // Missing splits on the actual best can otherwise make the theoretical
  // lap slower. Do not promise a negative or invented improvement.
  if (total > best.lap_duration + .003) return null
  return { total, gain: Math.max(0, best.lap_duration - total), best, parts }
}

export function stintAt(lap: Lap, stints: Stint[] | null): Stint | null {
  return stints?.filter((s) => s.driver_number === lap.driver_number && s.session_key === lap.session_key &&
    Number.isInteger(s.lap_start) && Number.isInteger(s.lap_end) && s.lap_start <= lap.lap_number && s.lap_end >= lap.lap_number)
    .sort((a, b) => b.lap_start - a.lap_start)[0] ?? null
}
export function tyreAge(lap: Lap, stint: Stint | null): number | null {
  return stint && Number.isFinite(stint.tyre_age_at_start) && stint.tyre_age_at_start >= 0
    ? stint.tyre_age_at_start + lap.lap_number - stint.lap_start : null
}
export function pitOnLap(lap: Lap, stops: PitStop[] | null) {
  return stops?.some((s) => s.session_key === lap.session_key && s.driver_number === lap.driver_number && s.lap_number === lap.lap_number) ?? false
}
export function paceWindow(drivers: LapDriver[], focused: boolean) {
  const all = drivers.flatMap((d) => timedLaps(d.laps))
  const visible = drivers.flatMap((d) => timedLaps(d.laps).filter((l) => !focused || l.lap_duration <= d.best.lap_duration * 1.15))
  const values = visible.map((l) => l.lap_duration)
  const low = values.length ? Math.min(...values) : 0
  const high = values.length ? Math.max(...values) : 1
  const pad = Math.max(.4, (high - low) * .08)
  return { min: Math.max(0, low - pad), max: high + pad, visible, hidden: all.length - visible.length,
    lastLap: Math.max(1, ...drivers.flatMap((d) => d.laps.map((l) => l.lap_number))) }
}

/** Break at missing/out/hidden laps: joining them implies unrecorded pace. */
export function pacePath(laps: TimedLap[], x: (n: number) => number, y: (n: number) => number) {
  let previous = -1
  return [...laps].sort((a, b) => a.lap_number - b.lap_number).map((l) => {
    const command = l.lap_number === previous + 1 ? 'L' : 'M'
    previous = l.lap_number
    return `${command}${x(l.lap_number).toFixed(2)},${y(l.lap_duration).toFixed(2)}`
  }).join(' ')
}
