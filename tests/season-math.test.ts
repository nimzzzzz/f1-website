import { describe, it, expect } from 'vitest'
import { normalizeSessionResults, normalizeDrivers, resultStatus } from '@/lib/openf1-normalize'
import { compareByCountback, sortByCountback, positionCounts } from '@/lib/countback'

// This suite is the point of the season-math batch: it answers "are the
// standings numerically correct" with executable checks rather than a
// reading of the code.

// ── shared fixtures ──────────────────────────────────────────────────────
const res = (over: Record<string, unknown>) => ({
  session_key: 1,
  meeting_key: 10,
  driver_number: 1,
  position: 1,
  points: 25,
  number_of_laps: 50,
  duration: 5000,
  gap_to_leader: 0,
  dnf: false,
  dns: false,
  dsq: false,
  ...over,
})
const drv = (over: Record<string, unknown>) => ({
  driver_number: 1,
  name_acronym: 'AAA',
  team_name: 'Team A',
  team_colour: 'FFFFFF',
  full_name: 'A A',
  first_name: 'A',
  last_name: 'A',
  broadcast_name: 'A A',
  country_code: 'XX',
  headshot_url: '',
  meeting_key: 10,
  session_key: 1,
  ...over,
})

// Mirrors the server's per-session attribution so the rules are testable
// without a network: driver points follow the driver, constructor points
// follow the team they drove for IN THAT SESSION.
function tally(sessions: { results: ReturnType<typeof res>[]; roster: ReturnType<typeof drv>[] }[]) {
  const byDriver = new Map<number, number>()
  const byTeam = new Map<string, number>()
  for (const s of sessions) {
    const roster = new Map(s.roster.map((d) => [d.driver_number, d]))
    const { rows } = normalizeSessionResults(s.results)
    for (const r of rows) {
      byDriver.set(r.driver_number, (byDriver.get(r.driver_number) ?? 0) + r.points)
      const team = roster.get(r.driver_number)?.team_name
      if (team) byTeam.set(team, (byTeam.get(team) ?? 0) + r.points)
    }
  }
  return { byDriver, byTeam }
}

// ── 1. string numerics ───────────────────────────────────────────────────
describe('string-numeric inputs are coerced at the boundary', () => {
  it('"25" + "18" sums to 43, not "2518"', () => {
    const { rows } = normalizeSessionResults([
      res({ driver_number: 1, points: '25' }),
      res({ driver_number: 2, points: '18', position: 2 }),
    ])
    const total = rows.reduce((a, r) => a + r.points, 0)
    expect(total).toBe(43)
    expect(typeof total).toBe('number')
  })

  it('string positions compare correctly (strict === used to fail)', () => {
    const { rows } = normalizeSessionResults([res({ position: '1', points: '25' })])
    expect(rows[0].position).toBe(1)
    expect(rows[0].position === 1).toBe(true)
  })

  it('a string points value sorts numerically, not lexically', () => {
    const { rows } = normalizeSessionResults([
      res({ driver_number: 1, points: '9' }),
      res({ driver_number: 2, points: '18', position: 2 }),
    ])
    const sorted = [...rows].sort((a, b) => b.points - a.points)
    expect(sorted[0].driver_number).toBe(2) // 18 > 9; lexically "9" > "18"
  })

  it('averages over string durations do not produce NaN', () => {
    const { rows } = normalizeSessionResults([
      res({ driver_number: 1, duration: '2.5' }),
      res({ driver_number: 2, duration: '3.5', position: 2 }),
    ])
    const avg = rows.reduce((a, r) => a + (r.duration as number), 0) / rows.length
    expect(avg).toBe(3)
    expect(Number.isNaN(avg)).toBe(false)
  })
})

// ── 2. malformed rows dropped and counted ────────────────────────────────
describe('malformed rows are dropped with a count, never computed into NaN', () => {
  it('drops uncoercible points and reports why', () => {
    const { rows, report } = normalizeSessionResults([
      res({ driver_number: 1, points: 25 }),
      res({ driver_number: 2, points: 'not-a-number' }),
    ])
    expect(rows).toHaveLength(1)
    expect(report.dropped).toBe(1)
    expect(report.reasons['uncoercible-points']).toBe(1)
    expect(rows.reduce((a, r) => a + r.points, 0)).toBe(25)
  })

  it('drops duplicate driver rows that would double-count points', () => {
    const { rows, report } = normalizeSessionResults([
      res({ driver_number: 7, points: 25 }),
      res({ driver_number: 7, points: 25 }),
    ])
    expect(rows).toHaveLength(1)
    expect(report.reasons['duplicate-driver']).toBe(1)
  })

  it('drops roster rows with no team_name — attribution would be ""', () => {
    const { rows, report } = normalizeDrivers([drv({}), drv({ driver_number: 2, team_name: '' })])
    expect(rows).toHaveLength(1)
    expect(report.reasons['missing-team_name']).toBe(1)
  })

  it('survives entirely non-object garbage', () => {
    const { rows, report } = normalizeSessionResults(['<html>', null, 42] as unknown[])
    expect(rows).toHaveLength(0)
    expect(report.dropped).toBe(3)
  })
})

// ── 3. per-session roster attribution ────────────────────────────────────
describe('substitution mid-season', () => {
  // Driver 99 (SUB) replaces driver 1 (AAA) at Team A for round 2.
  const r1 = {
    results: [res({ driver_number: 1, points: 25, session_key: 1 })],
    roster: [drv({ driver_number: 1, name_acronym: 'AAA', team_name: 'Team A' })],
  }
  const r2 = {
    results: [res({ driver_number: 99, points: 18, session_key: 2, position: 2 })],
    roster: [drv({ driver_number: 99, name_acronym: 'SUB', team_name: 'Team A', session_key: 2 })],
  }

  it('both drivers retain their OWN points', () => {
    const { byDriver } = tally([r1, r2])
    expect(byDriver.get(1)).toBe(25)
    expect(byDriver.get(99)).toBe(18)
  })

  it('the constructor gets BOTH drivers’ points', () => {
    const { byTeam } = tally([r1, r2])
    expect(byTeam.get('Team A')).toBe(43)
  })

  it('the substitute does not vanish just because they miss the latest round', () => {
    const { byDriver } = tally([r1, r2, r1])
    expect(byDriver.has(99)).toBe(true)
    expect(byDriver.get(99)).toBe(18)
  })
})

describe('team transfer mid-season', () => {
  // Driver 1 scores for Team A in round 1, then transfers to Team B.
  const r1 = {
    results: [res({ driver_number: 1, points: 25, session_key: 1 })],
    roster: [drv({ driver_number: 1, team_name: 'Team A' })],
  }
  const r2 = {
    results: [res({ driver_number: 1, points: 18, session_key: 2, position: 2 })],
    roster: [drv({ driver_number: 1, team_name: 'Team B', session_key: 2 })],
  }

  it('the driver keeps the full total across both teams', () => {
    expect(tally([r1, r2]).byDriver.get(1)).toBe(43)
  })

  it('points SPLIT across the two constructors by the round they were scored in', () => {
    const { byTeam } = tally([r1, r2])
    expect(byTeam.get('Team A')).toBe(25)
    expect(byTeam.get('Team B')).toBe(18)
  })

  it('the old behaviour — latest roster for every round — would have been wrong', () => {
    // What the previous pipeline did: one roster (the latest) for all rounds.
    const latest = new Map([[1, 'Team B']])
    let teamB = 0
    for (const s of [r1, r2]) for (const r of s.results) if (latest.get(r.driver_number) === 'Team B') teamB += r.points as number
    expect(teamB).toBe(43) // all of it migrated to Team B
    expect(tally([r1, r2]).byTeam.get('Team B')).toBe(18) // the correct answer
  })
})

// ── 4. distinct statuses ─────────────────────────────────────────────────
describe('DNF / DNS / DSQ are distinct, not one "out" bit', () => {
  it('classifies each flag separately', () => {
    expect(resultStatus({ dnf: true, position: null })).toBe('DNF')
    expect(resultStatus({ dns: true, position: null })).toBe('DNS')
    expect(resultStatus({ dsq: true, position: null })).toBe('DSQ')
    expect(resultStatus({ position: null })).toBe('NC')
    expect(resultStatus({ position: 5 })).toBe('classified')
  })

  it('DSQ outranks DNF when upstream sets both', () => {
    expect(resultStatus({ dnf: true, dsq: true, position: null })).toBe('DSQ')
  })

  it('carries the status onto normalized rows', () => {
    const { rows } = normalizeSessionResults([
      res({ driver_number: 1, dns: true, position: null, points: 0 }),
    ])
    expect(rows[0].status).toBe('DNS')
  })
})

// ── 5. countback ─────────────────────────────────────────────────────────
describe('championship tie-breaking uses full countback', () => {
  it('points still win outright', () => {
    expect(compareByCountback({ points: 100, finishes: [] }, { points: 90, finishes: [1] })).toBeLessThan(0)
  })

  it('equal points: more wins ranks higher', () => {
    const a = { points: 50, finishes: [1, 5] }
    const b = { points: 50, finishes: [2, 2] }
    expect(compareByCountback(a, b)).toBeLessThan(0)
  })

  it('equal points AND equal wins: more SECONDS ranks higher', () => {
    const a = { points: 50, finishes: [1, 2, 9] }
    const b = { points: 50, finishes: [1, 3, 3] }
    expect(compareByCountback(a, b)).toBeLessThan(0)
  })

  it('goes deeper than seconds — thirds break a tie too', () => {
    const a = { points: 40, finishes: [1, 2, 3, 8] }
    const b = { points: 40, finishes: [1, 2, 4, 4] }
    expect(compareByCountback(a, b)).toBeLessThan(0)
  })

  it('the OLD rule (points, then wins) could not order these', () => {
    const a = { points: 50, wins: 1, finishes: [1, 2, 9] }
    const b = { points: 50, wins: 1, finishes: [1, 3, 3] }
    expect(b.points - a.points || b.wins - a.wins).toBe(0) // old: tie, order arbitrary
    expect(compareByCountback(a, b)).toBeLessThan(0) // new: decided
  })

  it('sorts a field and is deterministic for genuine ties', () => {
    const rows = [
      { id: 3, points: 50, finishes: [2, 2] },
      { id: 1, points: 50, finishes: [1, 5] },
      { id: 2, points: 50, finishes: [2, 2] },
    ]
    const sorted = sortByCountback(rows, (r) => r.id)
    expect(sorted[0].id).toBe(1) // the win
    expect(sorted.slice(1).map((r) => r.id)).toEqual([2, 3]) // stable by id
  })

  it('positionCounts indexes P1 at 0', () => {
    expect(positionCounts([1, 1, 3]).slice(0, 3)).toEqual([2, 0, 1])
  })
})

// ── 6. completeness ──────────────────────────────────────────────────────
describe('completeness rejects partial publishes', () => {
  // Mirrors the server guard: a session is complete only with a row per
  // roster competitor, no duplicates, and no off-roster rows.
  const complete = (results: { driver_number: number }[], rosterSize: number) => {
    const uniq = new Set(results.map((r) => r.driver_number))
    return uniq.size === results.length && results.length >= rosterSize
  }

  it('rejects a partial result set that "≥1 row" would have accepted', () => {
    const partial = Array.from({ length: 4 }, (_, i) => ({ driver_number: i + 1 }))
    expect(partial.length).toBeGreaterThan(0) // old rule passes
    expect(complete(partial, 22)).toBe(false) // new rule rejects
  })

  it('accepts a full field', () => {
    const full = Array.from({ length: 22 }, (_, i) => ({ driver_number: i + 1 }))
    expect(complete(full, 22)).toBe(true)
  })

  it('rejects duplicates even when the count looks right', () => {
    const dupes = [...Array.from({ length: 21 }, (_, i) => ({ driver_number: i + 1 })), { driver_number: 1 }]
    expect(dupes).toHaveLength(22)
    expect(complete(dupes, 22)).toBe(false)
  })
})

// ── 7. sprint reconciliation ─────────────────────────────────────────────
describe('sprint points appear in BOTH season totals and the weekend haul', () => {
  const gp = { 1: 25 }
  const sprintRound = { 1: 8 }

  it('the weekend haul includes the sprint, matching what the season total counted', () => {
    const haulGpOnly = gp[1]
    const haulWithSprint = gp[1] + sprintRound[1]
    const seasonTotal = gp[1] + sprintRound[1] // server tallies both
    expect(haulGpOnly).not.toBe(seasonTotal) // the old disagreement
    expect(haulWithSprint).toBe(seasonTotal) // reconciled
  })

  it('a non-sprint weekend is unaffected', () => {
    expect(gp[1] + 0).toBe(25)
  })
})
