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
export async function getSeasonBundleSSR(): Promise<SeasonBundle | null> {
  // Local verification hook for the cold-cache lockout path (unset in prod).
  if (process.env.SIMULATE_SEASON_BLOCKED === '1') return null
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return null
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    const res = await fetch(`${proto}://${host}/api/season-data`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as SeasonDataResponse
    return body.blocked ? null : body
  } catch {
    return null
  }
}
