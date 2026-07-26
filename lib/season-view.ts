import type { SeasonBundle } from '@/lib/season-data'
import { asNum } from '@/lib/format'

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
