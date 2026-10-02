import type { Driver, Position, Session, SessionResult, StartingGrid, PitStop } from './openf1'
import { asNum } from './format'
import { resultStatus } from './openf1-normalize'

export type SessionKind = 'race' | 'qualifying' | 'practice'
export type ResultEntry = {
  driver_number: number
  position: number | null
  detail: SessionResult | null
}
export type ResultRow = ResultEntry & { driver: Driver }

export function sessionKind(session: Pick<Session, 'session_name' | 'session_type'>): SessionKind {
  if (/qualifying|shootout/i.test(session.session_name + session.session_type)) return 'qualifying'
  return /race|sprint/i.test(session.session_name + session.session_type) ? 'race' : 'practice'
}

/** OpenF1 attaches the official starting grid to its qualifying session. */
export function gridSessionFor(race: Session, sessions: Session[]): Session | null {
  if (sessionKind(race) !== 'race') return null
  const sprint = /sprint/i.test(race.session_name)
  return sessions.filter((s) => s.meeting_key === race.meeting_key && !s.is_cancelled &&
    sessionKind(s) === 'qualifying' && /sprint|shootout/i.test(s.session_name) === sprint &&
    Date.parse(s.date_start) < Date.parse(race.date_start))
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))[0] ?? null
}

/** A timing feed is a fallback, never a replacement for published results. */
export function classifyResults(details: SessionResult[], positions: Position[]): ResultEntry[] {
  if (details.length) return details.map((detail) => ({
    driver_number: detail.driver_number, position: detail.position, detail,
  })).sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
  const latest = new Map<number, Position>()
  for (const row of positions) {
    const n = asNum(row.driver_number)
    const p = asNum(row.position)
    const time = Date.parse(row.date)
    if (n === null || p === null || p < 1 || !Number.isFinite(time)) continue
    const old = latest.get(n)
    if (!old || time > Date.parse(old.date)) latest.set(n, { ...row, driver_number: n, position: p })
  }
  return [...latest.values()].map((r) => ({ driver_number: r.driver_number, position: r.position, detail: null }))
    .sort((a, b) => a.position - b.position)
}

export function resultRows(entries: ResultEntry[], drivers: Driver[]): ResultRow[] {
  const roster = new Map(drivers.map((d) => [d.driver_number, d]))
  return entries.map((r) => ({ ...r, driver: roster.get(r.driver_number) ?? {
    driver_number: r.driver_number, full_name: `Driver ${r.driver_number}`,
    first_name: 'Driver', last_name: String(r.driver_number), name_acronym: '',
    team_name: '', team_colour: 'AAAAAA', headshot_url: '', broadcast_name: '',
    country_code: null, meeting_key: r.detail?.meeting_key ?? 0, session_key: r.detail?.session_key ?? 0,
  } }))
}

export function teamColor(driver: Driver) {
  return /^[0-9a-f]{6}$/i.test(driver.team_colour) ? `#${driver.team_colour}` : '#aaaaaa'
}

export function timingValue(value: SessionResult['duration'], stage?: number): number | null {
  if (Array.isArray(value)) {
    if (stage !== undefined) return asNum(value[stage])
    for (let i = value.length - 1; i >= 0; i--) {
      const n = asNum(value[i])
      if (n !== null && n > 0) return n
    }
    return null
  }
  return stage === undefined ? asNum(value) : null
}

export function lastTimedStage(result: SessionResult | null): number | null {
  if (!Array.isArray(result?.duration)) return null
  for (let i = Math.min(2, result.duration.length - 1); i >= 0; i--) {
    if ((asNum(result.duration[i]) ?? 0) > 0) return i
  }
  return null
}

export function formatSessionTime(seconds: unknown): string {
  const n = asNum(seconds)
  if (n === null || n <= 0) return '—'
  // Round BEFORE splitting to avoid 1:60.000 at a minute boundary.
  const ms = Math.round(n * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor(ms / 60_000) % 60
  const s = ((ms % 60_000) / 1000).toFixed(3).padStart(6, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function sessionGap(result: SessionResult | null, kind: SessionKind, stage?: number): string {
  if (!result) return '—'
  const status = resultStatus(result)
  if (status !== 'classified') return status
  const gap = result.gap_to_leader
  if (typeof gap === 'string' && /LAP/i.test(gap)) return gap.startsWith('+') ? gap : `+${gap}`
  const index = stage ?? lastTimedStage(result)
  const seconds = Array.isArray(gap) ? (index === null ? null : asNum(gap[index])) : asNum(gap)
  if (seconds === null || seconds < 0) return '—'
  if (seconds === 0) return kind === 'race' ? 'LEADER' : 'FASTEST'
  return `+${seconds.toFixed(3)}s`
}

export function gridChanges(rows: ResultRow[], grid: StartingGrid[]) {
  const starts = new Map(grid.map((r) => [r.driver_number, r.position]))
  return rows.flatMap((row) => {
    const start = starts.get(row.driver_number)
    // A pit-lane start has no numeric grid position. DNS/DSQ/retirements
    // must not become a misleading gain from a classified position.
    if (!row.detail || resultStatus(row.detail) !== 'classified' || start === undefined || start < 1 || !row.position) return []
    return [{ ...row, start, finish: row.position, gain: start - row.position }]
  })
}

export function closestFinish(rows: ResultRow[]) {
  const finishers = rows.filter((r) => r.detail && resultStatus(r.detail) === 'classified')
  let best: { first: ResultRow; second: ResultRow; seconds: number } | null = null
  for (let i = 1; i < finishers.length; i++) {
    const first = finishers[i - 1], second = finishers[i]
    // Never subtract lap deficits as though they were seconds, nor bridge
    // a missing classification row and call the two cars consecutive.
    const a = first.detail?.gap_to_leader, b = second.detail?.gap_to_leader
    if (typeof a !== 'number' || typeof b !== 'number' || second.position !== (first.position ?? 0) + 1) continue
    const seconds = b - a
    if (seconds > 0 && (!best || seconds < best.seconds)) best = { first, second, seconds }
  }
  return best
}

export function teamPointsLeaders(rows: ResultRow[]): { names: string[]; points: number } | null {
  if (!rows.length || rows.some((r) => !r.driver.team_name || !r.detail || r.detail.points_available === false)) return null
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.driver.team_name, (totals.get(row.driver.team_name) ?? 0) + (row.detail?.points ?? 0))
  const points = Math.max(...totals.values())
  return points > 0 ? { names: [...totals].filter(([, n]) => n === points).map(([name]) => name), points } : null
}

export function driverTrace(positions: Position[], stops: PitStop[], driverNumber: number) {
  const sorted = positions.filter((r) => r.driver_number === driverNumber && r.position > 0 && Number.isFinite(Date.parse(r.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  if (!sorted.length) return null
  const start = Date.parse(sorted[0].date), end = Date.parse(sorted[sorted.length - 1].date)
  const span = Math.max(1, end - start)
  const points = sorted.map((r) => ({ x: (Date.parse(r.date) - start) / span, position: r.position }))
  const pits = stops.filter((r) => r.driver_number === driverNumber && Date.parse(r.date) >= start && Date.parse(r.date) <= end)
    .map((r) => ({ x: (Date.parse(r.date) - start) / span, lap: r.lap_number }))
  return { points, pits, minutes: Math.round(span / 60_000), best: Math.min(...sorted.map((r) => r.position)) }
}
