import { headers } from 'next/headers'
import type { SeasonBundle, SeasonDataResponse } from '@/lib/season-data'

// Bundle access for server-rendered PAGES (/drivers, /teams).
//
// Pages must NOT call unstable_cache/computeSeasonData directly: on Vercel
// each function has its own cache visibility (observed live: the page lambda
// missed the entry the API route had just written, recomputed, and died on
// openf1's rate limiter — 8/13 result sets 429'd). Instead, pages consume
// the deployment's own /api/season-data over HTTP: one cache authority,
// CDN-cached at the edge (s-maxage=300, SWR 1h), the exact path clients
// have exercised in production since phase 2.
//
// Failures log a structured [ssr-diag] line (visible in Vercel function
// logs) so any future WARMING UP sighting is attributable from the logs.
export async function getSeasonBundleSSR(): Promise<SeasonBundle | null> {
  const t0 = Date.now()
  const fail = (outcome: string, status?: number | null, xCache?: string | null) => {
    console.error(
      `[ssr-diag] outcome=${outcome} ms=${Date.now() - t0} status=${status ?? '-'} xCache=${xCache ?? '-'}`
    )
    return null
  }

  // Local verification hook for the cold-cache lockout path (unset in prod).
  if (process.env.SIMULATE_SEASON_BLOCKED === '1') return fail('simulated-blocked')
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return fail('no-host')
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    // The snapshot route serves statically (ISR), so this resolves in
    // milliseconds — the timeout is a hard bound so a pathological edge
    // case can never hold a page's Suspense open indefinitely.
    let res: Response
    try {
      res = await fetch(`${proto}://${host}/api/season-data`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : 'unknown'
      return fail(name === 'TimeoutError' ? 'timeout' : `abort-${name}`)
    }
    const xCache = res.headers.get('x-vercel-cache')
    if (!res.ok) return fail(`http-${res.status}`, res.status, xCache)
    const body = (await res.json()) as SeasonDataResponse
    if (body.blocked) return fail('blocked', res.status, xCache)
    return body
  } catch (err) {
    return fail(`outer-${err instanceof Error ? err.name : 'unknown'}`)
  }
}
