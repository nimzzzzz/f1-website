import { Suspense } from 'react'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import WarmingRetry from '@/components/WarmingRetry'
import DriversGallery, { type GalleryDriver } from './DriversGallery'

// STATIC with ISR, same regime as /api/season-data: the page is generated
// at build time from the season bundle and re-generated in the background
// every 5 minutes; a failed revalidation throws and keeps the last good
// page. NO request-time data fetch exists — the previous SSR self-fetch
// to the deployment's own API failed under real conditions the API never
// showed (proven: any Vercel-authenticated host poisons the cookie-less
// self-fetch with an SSO redirect while the browser API call succeeds).
export const revalidate = 300
// Background revalidations fetch ~17 paced result sets.
export const maxDuration = 60

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
