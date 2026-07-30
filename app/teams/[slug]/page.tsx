import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { toTeamMachine } from '@/lib/season-view'
import { teamToSlug } from '@/lib/team-data'
import { teamFacts } from '@/lib/team-facts'
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
  const snap = await buildSeasonSnapshot()
  if (snap.blocked) return []
  return snap.teamStandings.map((t) => ({ slug: teamToSlug(t.teamName) }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const snap = await buildSeasonSnapshot()
  if (snap.blocked) return {}
  const team = snap.teamStandings.find((t) => teamToSlug(t.teamName) === params.slug)
  return team ? { title: `${team.teamName} — LIGHTS OUT` } : {}
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

export default function TeamPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Machine slug={params.slug} />
    </Suspense>
  )
}
