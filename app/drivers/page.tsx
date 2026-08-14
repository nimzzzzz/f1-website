import { Suspense } from 'react'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import WarmingRetry from '@/components/WarmingRetry'
import DriversGallery from './DriversGallery'
import { toGalleryDrivers } from '@/lib/season-view'
import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'

// Search and share copy for this route. Written as the first words
// anyone sees in a result or a shared link, in the site's own register.
const META = {
  path: 'drivers',
  title: 'THE GRID',
  description:
    "All 22 drivers in championship order — car number, constructor and points, one driver at a time.",
} as const

// Metadata is GENERATED rather than static so it can see whether this
// page has its bundle. A data-less render is still a real URL with a
// correct canonical, but it is not something a search engine should keep
// — see degradedMeta in lib/seo. lib/season-data-server refuses to build
// in that state at all now; this is the second line of defence, and it
// costs nothing because the snapshot is already memoised for the render
// below.
export async function generateMetadata(): Promise<Metadata> {
  const snap = await buildSeasonSnapshot()
  return routeMeta({ ...META, noindex: snap.blocked })
}


// STATIC with ISR, same regime as /api/season-data: the page is generated
// at build time from the season bundle and re-generated in the background
// every 60 seconds; a failed revalidation throws and keeps the last good
// page. NO request-time data fetch exists — the previous SSR self-fetch
// to the deployment's own API failed under real conditions the API never
// showed (proven: any Vercel-authenticated host poisons the cookie-less
// self-fetch with an SSO redirect while the browser API call succeeds).
//
// 60, not 300: this used to declare 300 while the build baked 60, because
// computeSeasonData's inner openf1 fetches are revalidate-60 and Next takes
// the MINIMUM of the route and its fetches. 60 was therefore already the
// real behaviour — declaring it changes nothing at runtime and stops the
// code lying. Raising the fetches to 300 to honour the old number would
// have made the site staler, which is the opposite of what is wanted.
export const revalidate = 60
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

  // No bundle at all. The build now REFUSES to bake this state — see
  // loadForBuild in lib/season-data-server — so reaching it means a path
  // nobody predicted, and the metadata above marks the page noindex to
  // bound the damage.
  //
  // The claim that used to sit here, that a brand-new project's first
  // deploy was "the only path that bakes blocked", was false. Every local
  // build with a failing compute reached it, because the production
  // snapshot needed a Vercel-only env var and returned null off-platform;
  // and a real main build reached it too, when openf1 rate-limited five
  // meetings. It was found during a perf baseline, by accident, weeks
  // later. WarmingRetry still heals it for a visitor with JS — which is
  // exactly who was never the problem.
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

  // Derived through lib/season-view so the client refresh re-derives with
  // exactly the same code — see useLiveSnapshot in DriversGallery.
  const drivers = toGalleryDrivers(bundle)

  return <DriversGallery drivers={drivers} computedAt={bundle.computedAt} />
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
