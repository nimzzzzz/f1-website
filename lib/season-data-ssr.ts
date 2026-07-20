import { headers } from 'next/headers'
import type { SeasonBundle, SeasonDataResponse } from '@/lib/season-data'

// ── TEMP DIAGNOSTICS (fix/snapshot-persistence) ─────────────────────────
// Captures why an SSR bundle fetch failed (or how close a success ran to
// the 4s bound) so the intermittent WARMING UP can be attributed to a
// concrete upstream condition. Rendered by /drivers + /teams as a
// data-ssr-diag attribute and logged server-side. Remove after diagnosis.
export interface SSRDiag {
  outcome: string // ok | no-host | timeout | abort-<name> | http-<status> | blocked | json-<name>
  ms: number
  status: number | null
  xCache: string | null
  age: string | null
  vercelId: string | null
  coldLambda: boolean
  at: string
}

const lambdaBornAt = Date.now()
let invocations = 0

export function diagAttr(diag: SSRDiag | null): string {
  return diag ? JSON.stringify(diag) : 'none'
}

// Bundle access for server-rendered PAGES (/drivers, /teams).
//
// Pages must NOT call unstable_cache/computeSeasonData directly: on Vercel
// each function has its own cache visibility (observed live: the page lambda
// missed the entry the API route had just written, recomputed, and died on
// openf1's rate limiter — 8/13 result sets 429'd). Instead, pages consume
// the deployment's own /api/season-data over HTTP: one cache authority,
// CDN-cached at the edge (s-maxage=300, SWR 1h), the exact path clients
// have exercised in production since phase 2.
export async function getSeasonBundleSSRDiag(): Promise<{
  bundle: SeasonBundle | null
  diag: SSRDiag
}> {
  const coldLambda = ++invocations === 1
  const t0 = Date.now()
  const diag: SSRDiag = {
    outcome: 'ok',
    ms: 0,
    status: null,
    xCache: null,
    age: null,
    vercelId: null,
    coldLambda,
    at: new Date().toISOString(),
  }
  const finish = (outcome: string, bundle: SeasonBundle | null) => {
    diag.outcome = outcome
    diag.ms = Date.now() - t0
    if (outcome !== 'ok') {
      console.error(
        `[ssr-diag] outcome=${outcome} ms=${diag.ms} status=${diag.status} xCache=${diag.xCache} age=${diag.age} cold=${coldLambda} lambdaAgeS=${Math.round((Date.now() - lambdaBornAt) / 1000)} id=${diag.vercelId}`
      )
    }
    return { bundle, diag }
  }

  // Local verification hook for the cold-cache lockout path (unset in prod).
  if (process.env.SIMULATE_SEASON_BLOCKED === '1') return finish('simulated-blocked', null)
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return finish('no-host', null)
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
      return finish(name === 'TimeoutError' ? 'timeout' : `abort-${name}`, null)
    }
    diag.status = res.status
    diag.xCache = res.headers.get('x-vercel-cache')
    diag.age = res.headers.get('age')
    diag.vercelId = res.headers.get('x-vercel-id')
    if (!res.ok) return finish(`http-${res.status}`, null)
    let body: SeasonDataResponse
    try {
      body = (await res.json()) as SeasonDataResponse
    } catch (err) {
      return finish(`json-${err instanceof Error ? err.name : 'unknown'}`, null)
    }
    if (body.blocked) return finish('blocked', null)
    return finish('ok', body)
  } catch (err) {
    return finish(`outer-${err instanceof Error ? err.name : 'unknown'}`, null)
  }
}

export async function getSeasonBundleSSR(): Promise<SeasonBundle | null> {
  return (await getSeasonBundleSSRDiag()).bundle
}
