import { Suspense } from 'react'
import { getSeasonBundleSSR } from '@/lib/season-data-ssr'
import WarmingRetry from '@/components/WarmingRetry'
import TeamsBands, { type BandTeam } from './TeamsBands'

// Server-rendered: constructor order + rosters come from the cached season
// bundle, so the top bands (and their imagery) are in the initial HTML.
// Same cache entry as /api/season-data — stale-while-error inherited.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

async function Bands() {
  const bundle = await getSeasonBundleSSR()

  // Truly nothing to show (first-ever deploy built mid-outage, or the
  // snapshot fetch failed). Honest, present, and self-healing:
  // WarmingRetry re-renders the route until the snapshot exists.
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

  // Rosters join from driverStandings (surname + number, sorted by number) —
  // no separate drivers fetch.
  const rosterByTeam = new Map<string, { surname: string; driverNumber: number }[]>()
  for (const d of bundle.driverStandings) {
    if (!rosterByTeam.has(d.teamName)) rosterByTeam.set(d.teamName, [])
    rosterByTeam.get(d.teamName)!.push({ surname: d.surname, driverNumber: d.driverNumber })
  }
  for (const roster of rosterByTeam.values()) {
    roster.sort((a, b) => a.driverNumber - b.driverNumber)
  }

  const teams: BandTeam[] = bundle.teamStandings.map((t) => ({
    name: t.teamName,
    colour: `#${t.teamColour || 'F5F5F3'}`,
    points: Math.floor(t.points),
    position: t.position,
    wins: t.wins,
    drivers: rosterByTeam.get(t.teamName) ?? [],
  }))

  return <TeamsBands teams={teams} seasonYear={bundle.seasonYear} />
}

export default function TeamsPage() {
  // Suspense so a rare cold-cache compute streams the skeleton instead of
  // blanking first paint; the warm path resolves before the first flush.
  return (
    <Suspense fallback={<Skeleton />}>
      <Bands />
    </Suspense>
  )
}
