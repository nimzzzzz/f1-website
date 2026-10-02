import type { Driver, Stint } from './openf1'
import { finite, positiveInteger } from './session-experience'

export const COMPOUNDS = {
  SOFT: { color: '#ef565c', letter: 'S' }, MEDIUM: { color: '#e8cb5f', letter: 'M' },
  HARD: { color: '#eee', letter: 'H' }, INTERMEDIATE: { color: '#5dc984', letter: 'I' },
  WET: { color: '#68a5e8', letter: 'W' }, UNKNOWN: { color: '#aaa', letter: '?' },
} as const
export type Compound = keyof typeof COMPOUNDS
export type StrategyStint = { key: string; number: number; stint: number; compound: Compound; start: number | null; end: number | null; length: number | null; age: number | null }
export type StrategyDriver = { number: number; name: string; surname: string; acronym: string; team: string; color: string; stints: StrategyStint[] }
export function strategyStints(raw: Stint[], session: number): StrategyStint[] {
  const map = new Map<string, StrategyStint>()
  for (const row of raw) {
    if (row.session_key !== session || !positiveInteger(row.driver_number) || !positiveInteger(row.stint_number)) continue
    const key = `${session}-${row.driver_number}-${row.stint_number}`
    const previous = map.get(key)
    const start = positiveInteger(row.lap_start) ?? previous?.start ?? null
    const candidate = positiveInteger(row.lap_end) ?? previous?.end ?? null
    const end = start !== null && candidate !== null && candidate >= start ? candidate : null
    const name = row.compound?.toUpperCase()
    const compound: Compound = name in COMPOUNDS ? name as Compound : previous?.compound ?? 'UNKNOWN'
    const age = finite(row.tyre_age_at_start)
    map.set(key, { key, number: row.driver_number, stint: row.stint_number, compound, start, end,
      length: start !== null && end !== null ? end - start + 1 : null,
      age: age !== null && age >= 0 ? age : previous?.age ?? null })
  }
  return [...map.values()].sort((a, b) => a.number - b.number || a.stint - b.stint)
}
export function strategyDrivers(stints: StrategyStint[], drivers: Driver[], session: number): StrategyDriver[] {
  const roster = new Map(drivers.filter(d => d.session_key === session).map(d => [d.driver_number, d]))
  return [...new Set(stints.map(s => s.number))].map(number => {
    const d = roster.get(number)
    return { number, name: d?.full_name || `Driver ${number}`, surname: d?.last_name || `Driver ${number}`, acronym: d?.name_acronym || `#${number}`,
      team: d?.team_name || 'Team unavailable', color: /^[\da-f]{6}$/i.test(d?.team_colour ?? '') ? `#${d!.team_colour}` : '#aaa', stints: stints.filter(s => s.number === number) }
  }).sort((a, b) => a.surname.localeCompare(b.surname))
}
/** Overlapping records are ambiguous. A missing end is not permission to
 * extend a stint to the end of the session or declare a retirement. */
export function stintAtLap(driver: StrategyDriver, lap: number) {
  const matches = driver.stints.filter(s => s.start !== null && s.end !== null && s.start <= lap && s.end >= lap)
  return matches.length === 1 ? matches[0] : null
}
export function compoundMix(drivers: StrategyDriver[], lap: number) {
  const counts = Object.fromEntries(Object.keys(COMPOUNDS).map(c => [c, 0])) as Record<Compound, number>
  let covered = 0
  for (const driver of drivers) {
    const stint = stintAtLap(driver, lap)
    if (stint) { counts[stint.compound]++; covered++ }
  }
  return { counts, covered, missing: drivers.length - covered }
}
export function tyreAge(stint: StrategyStint | null, lap: number) {
  if (!stint || stint.age === null || stint.start === null || stint.end === null || lap < stint.start || lap > stint.end) return null
  return stint.age + lap - stint.start
}
export function compoundUsage(stints: StrategyStint[]) {
  return (Object.keys(COMPOUNDS) as Compound[]).map(compound => {
    const rows = stints.filter(s => s.compound === compound)
    const complete = rows.filter(s => s.length !== null)
    return { compound, count: rows.length, timed: complete.length, laps: complete.reduce((sum, s) => sum + s.length!, 0), longest: complete.length ? Math.max(...complete.map(s => s.length!)) : null }
  }).filter(c => c.count)
}
