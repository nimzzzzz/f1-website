import { unstable_cache } from 'next/cache'
import { clientKey, rateLimit } from '@/lib/rate-limit'

// Server-side probe for the openf1 live-session lockout. Browsers can't
// read the API's 401 (its error responses lack CORS headers), so the client
// asks this same-origin route, which can see the real status.
//
// This used to make ONE UNCACHED upstream request PER PUBLIC REQUEST, with
// no timeout — so anyone could turn a loop against this route into the same
// loop against openf1, from our IP and on our bill, and a slow upstream
// could pin a function open indefinitely. The lockout is a property of the
// whole API and changes on the timescale of a session, so caching it for
// 15s costs nothing in accuracy and collapses any volume of callers onto at
// most four upstream probes a minute.
export const dynamic = 'force-dynamic'

const UPSTREAM_TIMEOUT_MS = 5000
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

const probe = unstable_cache(
  async (): Promise<{ blocked: boolean; status: number }> => {
    try {
      const res = await fetch('https://api.openf1.org/v1/meetings?year=2026', {
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
      return { blocked: res.status === 401, status: res.status }
    } catch {
      // openf1 unreachable entirely — that's an outage, not the lockout.
      // A timeout lands here too, which is the correct reading: we could
      // not determine a lockout, so we do not claim one.
      return { blocked: false, status: 0 }
    }
  },
  ['openf1-status-v1'],
  { revalidate: 15 }
)

export async function GET(req: Request) {
  const limited = rateLimit(clientKey(req.headers), RATE_LIMIT, RATE_WINDOW_MS)
  if (!limited.allowed) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': String(limited.retryAfter),
      },
    })
  }
  const body = await probe()
  return Response.json(body, {
    headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=60' },
  })
}
