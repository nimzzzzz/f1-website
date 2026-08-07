import { asNum } from '@/lib/format'
import type { SessionResult, Driver } from '@/lib/openf1'

// THE BOUNDARY. Every openf1 numeric is coerced and every row is
// shape-validated HERE — inside the fetchers in lib/openf1.ts, the single
// place responses enter the system — rather than at each use site.
//
// Why the boundary and not the call sites: openf1 returns numeric fields as
// strings after post-session reprocessing (`points: "25.0"`, and
// gap_to_leader is observably str|int|float|null in live 2026 data). asNum
// existed but had to be remembered at every summation, comparison, sort and
// average. A missed call site is invisible until a race weekend turns
// `"25" + "18"` into "2518" or a strict `position === 1` silently stops
// matching. Normalising at the boundary makes the missed call site
// impossible to write: by the time data is reachable, it is already numbers.
//
// Malformed rows are DROPPED and COUNTED, never computed into NaN. The
// count is returned so callers can refuse to treat a mangled payload as
// complete (see the completeness guard in season-data-server).

export interface NormalizeReport {
  kept: number
  dropped: number
  reasons: Record<string, number>
}

const bump = (r: Record<string, number>, k: string) => {
  r[k] = (r[k] ?? 0) + 1
}

/** A result row that has passed validation: numerics are numbers. */
export interface CleanSessionResult extends Omit<SessionResult, 'position' | 'points' | 'number_of_laps' | 'duration' | 'gap_to_leader'> {
  position: number | null
  points: number
  number_of_laps: number | null
  duration: number | number[] | null
  gap_to_leader: number | number[] | null
  /** Distinct outcome, preserved rather than collapsed to a single bit. */
  status: 'classified' | 'DNF' | 'DNS' | 'DSQ' | 'NC'
}

/**
 * DNF / DNS / DSQ are DISTINCT outcomes and must survive to display. NC
 * ("not classified") is the real upstream case of a row with no position
 * and no flag set — rendering that as a position produced "P—".
 */
export function resultStatus(r: {
  dnf?: unknown
  dns?: unknown
  dsq?: unknown
  position: number | null
}): CleanSessionResult['status'] {
  if (r.dsq === true) return 'DSQ'
  if (r.dns === true) return 'DNS'
  if (r.dnf === true) return 'DNF'
  if (r.position === null) return 'NC'
  return 'classified'
}

const numOrNull = (v: unknown): number | null => asNum(v)
// duration/gap can legitimately be an array (multi-part times upstream)
const numOrArr = (v: unknown): number | number[] | null =>
  Array.isArray(v) ? v.map((x) => asNum(x) ?? 0) : asNum(v)

export function normalizeSessionResults(
  rows: unknown[]
): { rows: CleanSessionResult[]; report: NormalizeReport } {
  const out: CleanSessionResult[] = []
  const reasons: Record<string, number> = {}
  // Keyed by SESSION + driver: a meeting-level payload legitimately carries
  // one row per driver per session, so a driver-only key would discard
  // every session but the first.
  const seen = new Set<string>()

  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') {
      bump(reasons, 'not-an-object')
      continue
    }
    const r = raw as Record<string, unknown>
    const driver = numOrNull(r.driver_number)
    if (driver === null) {
      bump(reasons, 'missing-driver_number')
      continue
    }
    const sessionKey = numOrNull(r.session_key)
    const meetingKey = numOrNull(r.meeting_key)
    if (sessionKey === null || meetingKey === null) {
      bump(reasons, 'missing-keys')
      continue
    }
    const dedupe = `${sessionKey}:${driver}`
    if (seen.has(dedupe)) {
      // two rows for one driver in ONE session would double-count points
      bump(reasons, 'duplicate-driver')
      continue
    }
    // points is the field the championship is built on: an uncoercible
    // value must drop the row, not default to zero and silently understate
    // a driver's total.
    const points = numOrNull(r.points ?? 0)
    if (points === null) {
      bump(reasons, 'uncoercible-points')
      continue
    }
    const position = numOrNull(r.position)
    if (r.position !== null && r.position !== undefined && position === null) {
      bump(reasons, 'uncoercible-position')
      continue
    }
    seen.add(dedupe)
    const base = {
      session_key: sessionKey,
      meeting_key: meetingKey,
      driver_number: driver,
      position,
      points,
      number_of_laps: numOrNull(r.number_of_laps),
      duration: numOrArr(r.duration),
      gap_to_leader: numOrArr(r.gap_to_leader),
      dnf: r.dnf === true,
      dns: r.dns === true,
      dsq: r.dsq === true,
    }
    out.push({ ...base, status: resultStatus({ ...base, position }) } as CleanSessionResult)
  }

  return { rows: out, report: { kept: out.length, dropped: rows.length - out.length, reasons } }
}

export interface CleanDriver extends Omit<Driver, 'driver_number'> {
  driver_number: number
}

export function normalizeDrivers(
  rows: unknown[]
): { rows: CleanDriver[]; report: NormalizeReport } {
  const out: CleanDriver[] = []
  const reasons: Record<string, number> = {}
  const seen = new Set<string>()

  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') {
      bump(reasons, 'not-an-object')
      continue
    }
    const r = raw as Record<string, unknown>
    const num = numOrNull(r.driver_number)
    if (num === null) {
      bump(reasons, 'missing-driver_number')
      continue
    }
    const dedupe = `${numOrNull(r.session_key) ?? 'x'}:${num}`
    if (seen.has(dedupe)) {
      bump(reasons, 'duplicate-driver')
      continue
    }
    // team_name is what constructor attribution is built on — a roster row
    // without it cannot be attributed and must not silently become "".
    if (typeof r.team_name !== 'string' || r.team_name.trim() === '') {
      bump(reasons, 'missing-team_name')
      continue
    }
    if (typeof r.name_acronym !== 'string' || r.name_acronym.trim() === '') {
      bump(reasons, 'missing-name_acronym')
      continue
    }
    seen.add(dedupe)
    out.push({ ...(r as unknown as CleanDriver), driver_number: num })
  }

  return { rows: out, report: { kept: out.length, dropped: rows.length - out.length, reasons } }
}

/** One-line summary for build/server logs; empty when nothing was dropped. */
export function describeReport(label: string, report: NormalizeReport): string | null {
  if (report.dropped === 0) return null
  const detail = Object.entries(report.reasons)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  return `[openf1-normalize] ${label}: dropped ${report.dropped} of ${
    report.kept + report.dropped
  } rows (${detail})`
}
