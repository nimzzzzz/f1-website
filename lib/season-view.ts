import type { SeasonBundle } from '@/lib/season-data'
import { asNum } from '@/lib/format'
import { getRaceMeetings, CANCELLED_COUNTRIES } from '@/lib/openf1'
import { teamToSlug } from '@/lib/team-data'

// Pure bundle → view-model derivations, deliberately shared by BOTH the
// server render and the client refresh.
//
// /drivers and /teams are static + ISR: their HTML is built from a snapshot
// that may be up to a revalidation window old, and Vercel's
// stale-while-revalidate means the FIRST visitor after a quiet period is
// served the stale copy while regeneration happens behind them. The client
// then re-fetches /api/season-data and re-derives through these same
// functions, so the numbers converge without a second page load.
//
// They live here, not in the page, precisely so the two paths cannot drift:
// a fix to the gap arithmetic or the best-finish rule applies to both at
// once. Nothing here fetches — that stays the caller's job, which is what
// keeps the server path free of any request-time fetch.

export interface GalleryDriver {
  driverNumber: number
  firstName: string
  surname: string
  teamName: string
  teamColour: string
  nameAcronym: string
  countryCode: string | null
  points: number
}

export interface BlueprintTeam {
  name: string
  colour: string
  points: number
  position: number
  /** Best classified GP finish this season, either car; null if never classified. */
  bestFinish: number | null
  /** Points behind the team above; null for the championship leader. */
  gapAhead: number | null
}

export function toGalleryDrivers(bundle: SeasonBundle): GalleryDriver[] {
  return bundle.driverStandings.map((d) => ({
    driverNumber: d.driverNumber,
    firstName: d.firstName,
    surname: d.surname,
    teamName: d.teamName,
    teamColour: d.teamColour,
    nameAcronym: d.nameAcronym,
    countryCode: d.countryCode,
    points: d.points,
  }))
}

// ── driver detail: THE SEASON LINE ───────────────────────────────────────

/**
 * finished  — classified GP result, a point on the line
 * out       — retired / excluded (the bundle's `out` bit collapses
 *             DNF/DNS/DSQ into one flag, so the label is generic): the line
 *             BREAKS here
 * absent    — round happened, driver has no result row (joined mid-season):
 *             the line passes it by
 * upcoming  — not yet run: ghost station, no line
 * cancelled — struck from the calendar, kept in sequence
 */
export type StationStatus = 'finished' | 'out' | 'absent' | 'upcoming' | 'cancelled'

export interface SeasonStation {
  round: number // calendar sequence, cancelled rounds included
  circuit: string
  country: string
  /** ISO date_start — formatted by the view with explicit locale + UTC. */
  date: string
  status: StationStatus
  position: number | null
  points: number
  /**
   * Label for an out station. DNF stands in for the bundle's collapsed
   * DNF/DNS/DSQ bit; NC is a result row with no position and no out flag
   * (upstream marks some unclassified finishes this way — rendering it as a
   * position would print "P—").
   */
  outLabel?: 'DNF' | 'NC'
}

export interface DuelView {
  surname: string
  acronym: string
  theirPoints: number
  myPoints: number
  /** Rounds where both teammates classified. */
  bothClassified: number
  raceWins: number
  raceLosses: number
}

export interface DriverSeasonView {
  computedAt: string
  seasonYear: number | null
  driver: {
    number: number
    firstName: string
    surname: string
    teamName: string
    teamColour: string
    acronym: string
    countryCode: string | null
    points: number
    wins: number
    podiums: number
    position: number
  }
  stations: SeasonStation[]
  bestFinish: number | null
  dnfs: number
  duel: DuelView | null
}

export function toDriverSeason(bundle: SeasonBundle, acronym: string): DriverSeasonView | null {
  const me = bundle.driverStandings.find((d) => d.nameAcronym === acronym.toUpperCase())
  if (!me) return null

  const ordered = getRaceMeetings(bundle.meetings).sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )

  const stations: SeasonStation[] = ordered.map((m, i) => {
    const base = {
      round: i + 1,
      circuit: m.circuit_short_name,
      country: m.country_name,
      date: m.date_start,
    }
    if (CANCELLED_COUNTRIES.has(m.country_name)) {
      return { ...base, status: 'cancelled' as const, position: null, points: 0 }
    }
    const rows = bundle.resultsByRound[m.meeting_key]
    // The completeness guard means every completed GP has rows — no rows is
    // therefore a round that hasn't happened, never one with missing data.
    if (!rows) return { ...base, status: 'upcoming' as const, position: null, points: 0 }
    const mine = rows.find((r) => r.d === me.driverNumber)
    if (!mine) return { ...base, status: 'absent' as const, position: null, points: 0 }
    const pos = asNum(mine.p)
    if (mine.out || pos === null) {
      return {
        ...base,
        status: 'out' as const,
        position: pos,
        points: asNum(mine.pts) ?? 0,
        outLabel: mine.out ? ('DNF' as const) : ('NC' as const),
      }
    }
    return { ...base, status: 'finished' as const, position: pos, points: asNum(mine.pts) ?? 0 }
  })

  const bestFinish = stations.reduce<number | null>(
    (best, s) =>
      s.status === 'finished' && s.position !== null && (best === null || s.position < best)
        ? s.position
        : best,
    null
  )
  // NC (unclassified, no out flag) breaks the line but is not counted as a
  // DNF — the stat says what it counts.
  const dnfs = stations.filter((s) => s.outLabel === 'DNF').length

  // THE DUEL — highest-scoring other car in the same team (guards a >2-driver
  // team if a mid-season swap ever puts three in the standings).
  const teammate = bundle.driverStandings
    .filter((d) => d.teamName === me.teamName && d.driverNumber !== me.driverNumber)
    .sort((a, b) => b.points - a.points)[0]
  let duel: DuelView | null = null
  if (teammate) {
    let bothClassified = 0
    let raceWins = 0
    for (const rows of Object.values(bundle.resultsByRound)) {
      const a = rows.find((r) => r.d === me.driverNumber)
      const b = rows.find((r) => r.d === teammate.driverNumber)
      if (!a || !b || a.out || b.out) continue
      const pa = asNum(a.p)
      const pb = asNum(b.p)
      if (pa === null || pb === null) continue
      bothClassified++
      if (pa < pb) raceWins++
    }
    duel = {
      surname: teammate.surname,
      acronym: teammate.nameAcronym,
      theirPoints: Math.floor(teammate.points),
      myPoints: Math.floor(me.points),
      bothClassified,
      raceWins,
      raceLosses: bothClassified - raceWins,
    }
  }

  return {
    computedAt: bundle.computedAt,
    seasonYear: bundle.seasonYear,
    driver: {
      number: me.driverNumber,
      firstName: me.firstName,
      surname: me.surname,
      teamName: me.teamName,
      teamColour: me.teamColour,
      acronym: me.nameAcronym,
      countryCode: me.countryCode,
      points: Math.floor(me.points),
      wins: me.wins,
      podiums: me.podiums,
      position: me.position,
    },
    stations,
    bestFinish,
    dnfs,
    duel,
  }
}

// ── team detail: THE MACHINE ─────────────────────────────────────────────

export interface MachineDriver {
  acronym: string
  surname: string
  number: number
  points: number
}

export interface TeamMachineView {
  computedAt: string
  seasonYear: number | null
  name: string
  slug: string
  colour: string
  position: number
  /** Drivers sorted by points, descending — pairing bar reads left-heavy. */
  drivers: MachineDriver[]
  pairing: { winsA: number; winsB: number; bothClassified: number } | null
  season: {
    points: number
    wins: number
    podiums: number
    bestFinish: number | null
    /** Largest single-round team score, with where it happened. */
    biggestHaul: { points: number; circuit: string; round: number } | null
    dnfs: number
  }
}

export function toTeamMachine(bundle: SeasonBundle, slug: string): TeamMachineView | null {
  const standing = bundle.teamStandings.find((t) => teamToSlug(t.teamName) === slug)
  if (!standing) return null

  const drivers: MachineDriver[] = bundle.driverStandings
    .filter((d) => d.teamName === standing.teamName)
    .sort((a, b) => b.points - a.points)
    .map((d) => ({
      acronym: d.nameAcronym,
      surname: d.surname,
      number: d.driverNumber,
      points: Math.floor(d.points),
    }))
  const nums = new Set(drivers.map((d) => d.number))

  const ordered = getRaceMeetings(bundle.meetings)
    .filter((m) => !CANCELLED_COUNTRIES.has(m.country_name))
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())

  let podiums = 0
  let dnfs = 0
  let bestFinish: number | null = null
  let biggestHaul: TeamMachineView['season']['biggestHaul'] = null
  let winsA = 0
  let winsB = 0
  let bothClassified = 0
  const a = drivers[0]
  const b = drivers[1]

  ordered.forEach((m, i) => {
    const rows = bundle.resultsByRound[m.meeting_key]
    if (!rows) return
    let haul = 0
    for (const r of rows) {
      if (!nums.has(r.d)) continue
      haul += asNum(r.pts) ?? 0
      if (r.out) {
        dnfs++
        continue
      }
      const pos = asNum(r.p)
      if (pos === null) continue // unclassified, no out flag — the NC case
      if (pos <= 3) podiums++
      if (bestFinish === null || pos < bestFinish) bestFinish = pos
    }
    if (haul > (biggestHaul?.points ?? -1)) {
      biggestHaul = { points: haul, circuit: m.circuit_short_name, round: i + 1 }
    }
    if (a && b) {
      const ra = rows.find((r) => r.d === a.number)
      const rb = rows.find((r) => r.d === b.number)
      if (ra && rb && !ra.out && !rb.out) {
        const pa = asNum(ra.p)
        const pb = asNum(rb.p)
        if (pa !== null && pb !== null) {
          bothClassified++
          if (pa < pb) winsA++
          else winsB++
        }
      }
    }
  })
  // A zero-score biggest haul is honest for backmarkers, but a season with
  // no completed rounds has no haul at all.
  if (biggestHaul !== null && (biggestHaul as { points: number }).points === 0 && standing.points === 0 && ordered.length === 0) {
    biggestHaul = null
  }

  return {
    computedAt: bundle.computedAt,
    seasonYear: bundle.seasonYear,
    name: standing.teamName,
    slug,
    colour: `#${standing.teamColour || 'F5F5F3'}`,
    position: standing.position,
    drivers,
    pairing: a && b ? { winsA, winsB, bothClassified } : null,
    season: {
      points: Math.floor(standing.points),
      wins: standing.wins,
      podiums,
      bestFinish,
      biggestHaul,
      dnfs,
    },
  }
}

export function toBlueprintTeams(bundle: SeasonBundle): BlueprintTeam[] {
  // Points are floored before the gap is taken so the callout arithmetic
  // matches the numbers actually printed (a raw subtraction of unrounded
  // OpenF1 points can print a gap one off from the two totals beside it).
  const rows = bundle.teamStandings.map((t) => ({ ...t, points: Math.floor(t.points) }))

  // BEST FINISH — best CLASSIFIED grand prix result this season from either
  // car, derived from resultsByRound, which the bundle already carries: it is
  // grand-prix-only (matching the wins semantic it replaced) and already
  // flags retirements and exclusions with `out`.
  const teamOfDriver = new Map(bundle.driverStandings.map((d) => [d.driverNumber, d.teamName]))
  const bestByTeam = new Map<string, number>()
  for (const round of Object.values(bundle.resultsByRound)) {
    for (const row of round) {
      if (row.out) continue // DNF / DNS / DSQ still carries a position upstream
      const pos = asNum(row.p) // positions can arrive as strings after reprocessing
      if (pos === null) continue
      const team = teamOfDriver.get(row.d)
      if (!team) continue
      const current = bestByTeam.get(team)
      if (current === undefined || pos < current) bestByTeam.set(team, pos)
    }
  }

  return rows.map((t, i) => ({
    name: t.teamName,
    colour: `#${t.teamColour || 'F5F5F3'}`,
    points: t.points,
    position: t.position,
    bestFinish: bestByTeam.get(t.teamName) ?? null,
    gapAhead: i === 0 ? null : rows[i - 1].points - t.points,
  }))
}
