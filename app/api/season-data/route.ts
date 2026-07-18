import { getCachedSeasonData } from '@/lib/season-data-server'

// HTTP shell over the shared cached bundle (lib/season-data-server) — the
// same cache entry the server-rendered /drivers and /teams pages read.

// Cold computes fetch ~17 result sets; paced batches keep openf1's burst
// limiter happy but need headroom beyond the default function budget.
export const maxDuration = 30

export async function GET() {
  try {
    const bundle = await getCachedSeasonData()
    return Response.json(bundle, {
      headers: {
        // CDN shield: serve from edge for 5 min, stale-while-revalidate 1h
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    // No complete bundle has EVER been cached (cold start during a live
    // session) — report honestly; consumers fall back to lockout states.
    return Response.json(
      { blocked: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
