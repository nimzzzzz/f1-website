import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { toTeamMachine } from '@/lib/season-view'
import { teamToSlug } from '@/lib/team-data'
import { teamFacts } from '@/lib/team-facts'
import { canonicalTeamSlug } from '@/lib/known-slugs'
import { resolveTeamParams } from '@/lib/static-params'
import WarmingRetry from '@/components/WarmingRetry'
import TeamMachine from './TeamMachine'

// STATIC with ISR, same regime as every other data page: all 11 slugs
// prerendered from the season bundle, background-revalidated; failed
// revalidations keep the last good page. This replaces the site's last
// pre-redesign fossil — a fully client-rendered page ('use client' +
// useParams + a browser fetch) that hotlinked CDN imagery and SSR'd only a
// skeleton. The snapshot is read DIRECTLY (never over HTTP — the SSR
// self-fetch is what broke on Vercel-authenticated hosts).
export const revalidate = 60
// Background revalidations fetch ~17 paced result sets.
export const maxDuration = 60

export async function generateStaticParams() {
  // See the note in app/drivers/[acronym]/page.tsx — falls back to the
  // committed roster rather than returning [], and throws if both the
  // bundle and the fallback are unusable.
  const snap = await buildSeasonSnapshot()
  return resolveTeamParams(snap).values
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const snap = await buildSeasonSnapshot()
  if (snap.blocked) return {}
  const team = snap.teamStandings.find((t) => teamToSlug(t.teamName) === params.slug)
  if (!team) return {}
  const ord = (n: number) => {
    const su = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (su[(v - 20) % 10] || su[v] || su[0])
  }
  const pair = team.driverSurnames.length ? `${team.driverSurnames.join(' and ')}. ` : ''
  const wins = team.wins > 0 ? `, ${team.wins} win${team.wins > 1 ? 's' : ''}` : ''
  return routeMeta({
    path: `teams/${params.slug}`,
    title: team.teamName.toUpperCase(),
    description:
      `${team.teamName} in the 2026 Formula 1 season. ${pair}` +
      `${ord(team.position)} in the constructors' championship on ${Math.floor(team.points)} points${wins}.`,
  })
}

function Skeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-end px-6 pb-16 md:px-14">
      <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
      <div className="mt-8 h-32 w-[70%] animate-pulse rounded bg-white/5" />
    </div>
  )
}

async function Machine({ slug }: { slug: string }) {
  const snap = await buildSeasonSnapshot()
  const bundle = snap.blocked ? null : snap

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

  // Derived through lib/season-view so the client refresh re-derives with
  // exactly the same code, keyed by slug — never by array index.
  const view = toTeamMachine(bundle, slug)
  if (!view) notFound()

  return <TeamMachine view={view} facts={teamFacts(slug)} />
}

export default async function TeamPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Real 404 for unknown slugs, before Suspense and before any season
  // computation — see the note in app/drivers/[acronym]/page.tsx.
  const canonical = canonicalTeamSlug(params.slug)
  if (!canonical) notFound()
  if (params.slug !== canonical) redirect(`/teams/${canonical}`)

  return (
    <Suspense fallback={<Skeleton />}>
      <Machine slug={canonical} />
    </Suspense>
  )
}
