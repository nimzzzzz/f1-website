import { Suspense } from 'react'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { asNum } from '@/lib/format'
import WarmingRetry from '@/components/WarmingRetry'
import TeamsBlueprint, { type BlueprintTeam } from './TeamsBlueprint'

// STATIC with ISR, same regime as /api/season-data and /drivers: built
// from the bundle, background-revalidated every 5 minutes, failed
// revalidations keep the last good page, and no request-time fetch can
// fail (the old SSR self-fetch broke on Vercel-authenticated hosts).
export const revalidate = 300
export const maxDuration = 60

function Skeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
      <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
      <div className="mt-10 space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-[70%] animate-pulse rounded bg-white/5" />
        ))}
      </div>
      <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING CONSTRUCTORS…</p>
    </div>
  )
}

async function Blueprint() {
  const snap = await buildSeasonSnapshot()
  const bundle = snap.blocked ? null : snap

  // Truly nothing to show (a brand-new project's first-ever deploy built
  // mid-outage — the only path that bakes blocked). Honest, present, and
  // self-healing: WarmingRetry re-renders until a revalidation lands.
  if (!bundle) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        <WarmingRetry />
        <p className="label-mono text-[var(--text-dim)]">
          STANDINGS DATA IS WARMING UP — HOLD ON A MOMENT
        </p>
      </div>
    )
  }

  if (bundle.teamStandings.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        <p className="label-mono text-[var(--text-dim)]">NO CONSTRUCTOR DATA YET</p>
      </div>
    )
  }

  // This page is the CONSTRUCTOR and the MACHINE — no roster. Drivers have
  // their own page, and the callouts on each car are the substance here.
  //
  // Points are floored before the gap is taken so the callout arithmetic
  // matches the numbers actually printed (a raw subtraction of unrounded
  // OpenF1 points can print a gap one off from the two totals beside it).
  const rows = bundle.teamStandings.map((t) => ({ ...t, points: Math.floor(t.points) }))

  // BEST FINISH — best CLASSIFIED grand prix result this season from either
  // car. Derived from resultsByRound, which the bundle already carries: it is
  // grand-prix-only (matching the wins semantic it replaces) and already
  // flags retirements and exclusions with `out`, so no schema change, no
  // extra upstream call, and nothing new to fetch at request time.
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

  const teams: BlueprintTeam[] = rows.map((t, i) => ({
    name: t.teamName,
    colour: `#${t.teamColour || 'F5F5F3'}`,
    points: t.points,
    position: t.position,
    bestFinish: bestByTeam.get(t.teamName) ?? null,
    gapAhead: i === 0 ? null : rows[i - 1].points - t.points,
  }))

  return <TeamsBlueprint teams={teams} seasonYear={bundle.seasonYear} />
}

export default function TeamsPage() {
  // Suspense so a rare cold-cache compute streams the skeleton instead of
  // blanking first paint; the warm path resolves before the first flush.
  return (
    <Suspense fallback={<Skeleton />}>
      <Blueprint />
    </Suspense>
  )
}
