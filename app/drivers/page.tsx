import { Suspense } from 'react'
import { getSeasonBundleSSR } from '@/lib/season-data-ssr'
import LiveSessionNotice from '@/components/LiveSessionNotice'
import DriversGallery, { type GalleryDriver } from './DriversGallery'

// Server-rendered: championship identity comes straight from the cached
// season bundle, so panel 1 (the real P1) and its headshot preload ship in
// the initial HTML — no hydration wait, no client standings fetch. The
// bundle is the same 5-min durable cache entry /api/season-data serves;
// this page inherits its stale-while-error behavior for free.
export const dynamic = 'force-dynamic'
// Cold computes fetch ~17 paced result sets — same budget as the API route.
export const maxDuration = 30

function Skeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
      <div className="h-3 w-36 animate-pulse rounded bg-white/5" />
      <div className="mt-10 h-56 w-[70%] animate-pulse rounded bg-white/5" />
      <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING THE GRID…</p>
    </div>
  )
}

async function Gallery() {
  const bundle = await getSeasonBundleSSR()

  // Cold cache during a live-session lockout: the honest state, server-side.
  if (!bundle) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center">
        <LiveSessionNotice variant="full" />
      </div>
    )
  }

  // Genuine pre-season (complete bundle, no completed races yet).
  if (bundle.driverStandings.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        <p className="label-mono text-[var(--text-dim)]">NO DRIVER DATA YET</p>
      </div>
    )
  }

  const drivers: GalleryDriver[] = bundle.driverStandings.map((d) => ({
    driverNumber: d.driverNumber,
    firstName: d.firstName,
    surname: d.surname,
    teamName: d.teamName,
    teamColour: d.teamColour,
    nameAcronym: d.nameAcronym,
    countryCode: d.countryCode,
    points: d.points,
  }))

  return <DriversGallery drivers={drivers} />
}

export default function DriversPage() {
  // Suspense so a rare cold-cache compute (~15s of paced upstream fetches)
  // streams the skeleton instead of blanking first paint; the warm path
  // resolves before the first flush, so content + preloads are in the
  // initial HTML.
  return (
    <Suspense fallback={<Skeleton />}>
      <Gallery />
    </Suspense>
  )
}
