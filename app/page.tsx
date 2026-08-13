import { buildSeasonSnapshot } from '@/lib/season-data-server'
import HomeClient from './HomeClient'

// STATIC with ISR — the same regime as /drivers, /teams and
// /api/season-data. The page is generated from the season bundle and
// re-generated in the background every 60s; the client freshness hook in
// HomeClient tops it up from /api/season-data and only ever adopts a bundle
// with a strictly newer computedAt.
//
// This route used to be force-dynamic. That was NEVER a product
// requirement: nothing on this page needs request-time data. The NOW
// countdown ticks from Date.now() in the browser on a 1s interval, and the
// live/next-session state is derived in HomeClient from the calendar it
// already holds, compared against the browser's clock. The dynamic
// rendering existed for one reason only — the server shell called
// getSeasonBundleSSR(), which called headers() to reconstruct the
// deployment's own origin so it could HTTP-fetch itself, and headers()
// opts a route out of static rendering. The dynamic regime existed to
// serve the self-fetch, and the self-fetch existed to fetch what
// buildSeasonSnapshot() returns directly. Both are gone.
export const revalidate = 60
// Background revalidations fetch ~22 paced openf1 result sets.
export const maxDuration = 60

export default async function HomePage() {
  // Local verification hook for the cold-cache lockout path (unset in prod).
  // Previously lived in season-data-ssr.ts; kept because it is the only way
  // to exercise the "no bundle at all" branch without an actual outage.
  if (process.env.SIMULATE_SEASON_BLOCKED === '1') {
    return <HomeClient initialBundle={null} />
  }
  const snap = await buildSeasonSnapshot()
  return <HomeClient initialBundle={snap.blocked ? null : snap} />
}
