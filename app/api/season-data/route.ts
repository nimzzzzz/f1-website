import { buildSeasonSnapshot } from '@/lib/season-data-server'

// STATIC with ISR: the season bundle is generated at build time and
// refreshed in the background every 5 minutes. Serving is instant — the
// snapshot comes out of the Full Route Cache like a static file, globally,
// and NO user request ever runs the ~15s openf1 compute inline. A failed
// background revalidation throws upstream, which keeps the last good
// snapshot serving (stale-while-error); openf1 lockouts therefore never
// blank anything, they just pause freshness.
export const dynamic = 'force-static'
export const revalidate = 300
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
  return Response.json(bundle, {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
    },
  })
}
