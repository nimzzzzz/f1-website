import { Suspense } from 'react'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import WarmingRetry from '@/components/WarmingRetry'
import TeamsBands, { type BandTeam } from './TeamsBands'

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

async function Bands() {
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
