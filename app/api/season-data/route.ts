import { buildSeasonSnapshot } from '@/lib/season-data-server'

// STATIC with ISR: the season bundle is generated at build time and
// refreshed in the background every 60 seconds. Serving is instant — the
// snapshot comes out of the Full Route Cache like a static file, globally,
// and NO user request ever runs the ~15s openf1 compute inline. A failed
// background revalidation throws upstream, which keeps the last good
// snapshot serving (stale-while-error); openf1 lockouts therefore never
// blank anything, they just pause freshness.
//
// This window is the CEILING on how current the whole site can be: the
// pages' client-side refresh (lib/use-live-snapshot) reads this endpoint,
// so nothing anywhere can be fresher than what is cached here.
//
// 60, not the 300 this used to declare. Next takes the minimum of a route's
// revalidate and its inner fetches, and computeSeasonData's openf1 reads are
// revalidate-60, so 60 was ALREADY the baked value — the 300 was a comment
// on nothing. The cost of 60 is bounded by traffic, not by the window: ISR
// only regenerates when a request arrives after expiry, and the inner fetch
// cache means no regeneration re-reads openf1 more than once a minute
// however many requests land.
export const dynamic = 'force-static'
export const revalidate = 60
// Background revalidations fetch ~17 paced result sets.
export const maxDuration = 60

export async function GET() {
  const bundle = await buildSeasonSnapshot()
  // The blocked placeholder (only reachable on a brand-new project's
  // first-ever deploy) must never be edge-cacheable: a 200 with s-maxage
  // let PoPs echo the poison for minutes after recovery. Status stays 200
  // because a non-200 during build prerender silently demotes the route
  // to fully dynamic (verified against Next 14.2.5), which would put the
  // ~15s compute back into the request path.
  if (bundle.blocked) {
    return Response.json(bundle, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  // NOTE: on the cached path Next serves its own ISR headers and this one
  // never reaches the client (verified live: the response carries
  // `public, max-age=0, must-revalidate`). It is kept, aligned to the
  // revalidate window above, only as the correct answer if this route is
  // ever served dynamically — not as something that shapes edge behaviour
  // today.
  return Response.json(bundle, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=86400',
    },
  })
}
