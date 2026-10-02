import type { Driver, PitStop, Stint } from './openf1'

export type PitMetric = 'lane' | 'stationary'
export type PitVisit = {
  key: string; session: number; number: number; lap: number | null; date: string;
  lane: number | null; stationary: number | null; ordinal: number; total: number;
  name: string; surname: string; acronym: string; team: string; color: string;
}
const positive = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
const lapNumber = (n: unknown): number | null => typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null

export function pitTime(seconds: number | null | undefined, minutes = false): string {
  if (!positive(seconds)) return 'N/A'
  // Extended visits remain visible, but do not turn a clock into 1600.00s.
  const hundredths = Math.round(seconds! * 100)
  return hundredths < 6000 && !minutes ? (hundredths / 100).toFixed(2)
    : `${Math.floor(hundredths / 6000)}:${((hundredths % 6000) / 100).toFixed(2).padStart(5, '0')}`
}
export const pitValue = (visit: PitVisit, metric: PitMetric) => visit[metric]
export function median(values: number[]): number | null {
  const sorted = values.filter(n => positive(n) !== null).sort((a, b) => a - b)
  if (!sorted.length) return null
  const i = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2
}

/** Distinct dates preserve two genuine visits on the same lap. Incomplete
 * polling duplicates cannot erase already published duration fields. */
export function pitVisits(raw: PitStop[], drivers: Driver[], session: number): PitVisit[] {
  const roster = new Map(drivers.filter(d => d.session_key === session).map(d => [d.driver_number, d]))
  const unique = new Map<string, PitVisit>()
  for (const p of raw) {
    if (p.session_key !== session || !Number.isInteger(p.driver_number) || p.driver_number <= 0) continue
    const lap = lapNumber(p.lap_number)
    const date = Number.isFinite(Date.parse(p.date)) ? new Date(p.date).toISOString() : ''
    const key = `${session}-${p.driver_number}-${date || `lap-${lap ?? 'unknown'}`}`
    const previous = unique.get(key)
    const lane = positive(p.lane_duration) ?? positive(p.pit_duration) ?? previous?.lane ?? null
    let stationary = positive(p.stop_duration) ?? previous?.stationary ?? null
    if (lane !== null && stationary !== null && stationary > lane) stationary = null
    const d = roster.get(p.driver_number)
    unique.set(key, {
      key, session, number: p.driver_number, lap, date, lane, stationary, ordinal: 0, total: 0,
      name: d?.full_name || `Driver ${p.driver_number}`, surname: d?.last_name || `Driver ${p.driver_number}`,
      acronym: d?.name_acronym || String(p.driver_number), team: d?.team_name || 'Team unavailable',
      color: /^[\da-f]{6}$/i.test(d?.team_colour ?? '') ? `#${d!.team_colour}` : '#b7b7b7',
    })
  }
  const visits = [...unique.values()].sort((a, b) => (a.lap ?? Infinity) - (b.lap ?? Infinity) || a.date.localeCompare(b.date) || a.number - b.number)
  const totals = new Map<number, number>()
  const ordinals = new Map<number, number>()
  for (const v of visits) totals.set(v.number, (totals.get(v.number) ?? 0) + 1)
  return visits.map(v => {
    const ordinal = (ordinals.get(v.number) ?? 0) + 1
    ordinals.set(v.number, ordinal)
    return { ...v, ordinal, total: totals.get(v.number)! }
  })
}

export function rankVisits(visits: PitVisit[], metric: PitMetric) {
  return [...visits].filter(v => pitValue(v, metric) !== null)
    .sort((a, b) => pitValue(a, metric)! - pitValue(b, metric)! || (a.lap ?? Infinity) - (b.lap ?? Infinity))
}

export function pitWindows(visits: PitVisit[]) {
  const known = visits.filter(v => v.lap !== null)
  if (!known.length) return []
  const end = Math.max(...known.map(v => v.lap!))
  const span = Math.max(5, Math.ceil(end / 80) * 5)
  return Array.from({ length: Math.ceil(end / span) }, (_, i) => {
    const start = i * span + 1
    return { start, end: Math.min(end, start + span - 1), visits: known.filter(v => v.lap! >= start && v.lap! < start + span) }
  })
}

export function pitTeams(visits: PitVisit[], metric: PitMetric) {
  const teams = new Map<string, PitVisit[]>()
  for (const v of visits) {
    // Missing roster entries are individual unknowns, not a fictional team.
    if (v.team === 'Team unavailable') continue
    teams.set(v.team, [...(teams.get(v.team) ?? []), v])
  }
  return [...teams.entries()].map(([name, rows]) => {
    const timed = rows.flatMap(v => v[metric] === null ? [] : [v[metric]!])
    return { name, color: rows[0].color, count: rows.length, timed: timed.length,
      median: median(timed), best: timed.length ? Math.min(...timed) : null,
      worst: timed.length ? Math.max(...timed) : null }
  }).sort((a, b) => (a.median ?? Infinity) - (b.median ?? Infinity) || a.name.localeCompare(b.name))
}

/** A tyre change is only assigned when the recorded stint boundary matches
 * this visit. A later unrelated stint must not be attached to a drive-through. */
export function pitTyres(visit: PitVisit, stints: Stint[] | null) {
  if (!stints || visit.lap === null) return null
  const rows = stints.filter(s => s.session_key === visit.session && s.driver_number === visit.number)
  const before = rows.find(s => s.lap_end === visit.lap)
  const after = rows.find(s => s.lap_start === visit.lap! + 1)
  return before && after && before.stint_number !== after.stint_number ? { before, after } : null
}
