import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { toDriverSeason } from '@/lib/season-view'
import { canonicalDriverSlug } from '@/lib/known-slugs'
import WarmingRetry from '@/components/WarmingRetry'
import DriverSeasonLine from './DriverSeasonLine'

// STATIC with ISR, same regime as /drivers and /teams: every driver page is
// prerendered from the season bundle (generateStaticParams below) and
// background-revalidated; failed revalidations keep the last good page.
// This replaces a fully client-rendered page — 'use client' + useParams +
// two browser fetches — which SSR'd only a skeleton: no driver identity in
// the HTML, no static generation, and the whole page blanked to a spinner
// on every visit. The snapshot is read DIRECTLY (never over HTTP — the SSR
// self-fetch pattern is what broke on Vercel-authenticated hosts).
export const revalidate = 60
// Background revalidations fetch ~17 paced result sets.
export const maxDuration = 60

export async function generateStaticParams() {
  // At build time the snapshot may be the blocked placeholder (first-ever
  // deploy mid-outage). Returning [] is safe: dynamicParams is on by
  // default, so every acronym still generates on first request and enters
  // the ISR cache from there.
  const snap = await buildSeasonSnapshot()
  if (snap.blocked) return []
  return snap.driverStandings.map((d) => ({ acronym: d.nameAcronym.toLowerCase() }))
}

export async function generateMetadata({
  params,
}: {
  params: { acronym: string }
}): Promise<Metadata> {
  const snap = await buildSeasonSnapshot()
  if (snap.blocked) return {}
  const me = snap.driverStandings.find(
    (d) => d.nameAcronym === params.acronym.toUpperCase()
  )
  return me ? { title: `${me.surname} — LIGHTS OUT` } : {}
}

function Skeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-end px-6 pb-16 md:px-14">
      <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
      <div className="mt-8 h-40 w-[60%] animate-pulse rounded bg-white/5" />
    </div>
  )
}

async function SeasonLine({ acronym }: { acronym: string }) {
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
  // exactly the same code, keyed by acronym — never by array index.
  const view = toDriverSeason(bundle, acronym)
  if (!view) notFound()

  return <DriverSeasonLine view={view} />
}

export default function DriverPage({ params }: { params: { acronym: string } }) {
  // Validate BEFORE the Suspense boundary and before any season work.
  // Inside Suspense the response has already started streaming, so
  // notFound() there cannot set a status — unknown slugs used to return
  // 200 with not-found markup after awaiting the snapshot. Here it is a
  // real 404 with zero computation. See lib/known-slugs.
  const canonical = canonicalDriverSlug(params.acronym)
  if (!canonical) notFound()
  // Canonical form is LOWERCASE, matching generateStaticParams and every
  // internal link on the site; /drivers/VER redirects to /drivers/ver so
  // there is exactly one indexable URL per driver.
  if (params.acronym !== canonical) redirect(`/drivers/${canonical}`)

  return (
    <Suspense fallback={<Skeleton />}>
      <SeasonLine acronym={canonical} />
    </Suspense>
  )
}
