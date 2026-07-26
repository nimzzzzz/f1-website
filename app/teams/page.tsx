import { Suspense } from 'react'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { toBlueprintTeams } from '@/lib/season-view'
import WarmingRetry from '@/components/WarmingRetry'
import TeamsBlueprint from './TeamsBlueprint'

// STATIC with ISR, same regime as /api/season-data and /drivers: built
// from the bundle, background-revalidated every 60 seconds, failed
// revalidations keep the last good page, and no request-time fetch can
// fail (the old SSR self-fetch broke on Vercel-authenticated hosts).
// 60 rather than the 300 this used to declare — see the note in
// app/drivers/page.tsx; 60 was already the effective value.
export const revalidate = 60
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
  // The derivation (floored points, best classified finish, gap to the team
  // above) lives in lib/season-view so the client refresh re-derives through
  // exactly the same code — see useLiveSnapshot in TeamsBlueprint.
  const teams = toBlueprintTeams(bundle)

  return (
    <TeamsBlueprint
      teams={teams}
      seasonYear={bundle.seasonYear}
      computedAt={bundle.computedAt}
    />
  )
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
