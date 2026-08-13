// Per-client request budget for the public proxy routes.
//
// HONEST SCOPE: this is an in-memory fixed-window counter, so it is
// per-instance. On Vercel each concurrent lambda has its own map, and a
// scaled-out deployment enforces N × the limit in aggregate; a cold start
// forgets everything. It is therefore a brake on casual abuse and runaway
// clients, NOT a security control against a determined attacker — that
// would need shared state (Redis/KV/Durable Object) the project does not
// have. It is deployed as the cheap 90% because the alternative on offer
// was nothing at all, and the cache-cardinality limit in
// openf1-proxy-policy is the control that actually bounds the damage.

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()

// Bound the map itself, or the rate limiter becomes the memory-exhaustion
// bug it was added to prevent.
const MAX_TRACKED = 5000

function sweep(now: number) {
  for (const [k, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(k)
  }
  if (buckets.size > MAX_TRACKED) {
    // Still over after dropping expired windows: drop oldest-resetting
    // first. Approximate by iteration order, which is insertion order.
    const excess = buckets.size - MAX_TRACKED
    let i = 0
    for (const k of buckets.keys()) {
      if (i++ >= excess) break
      buckets.delete(k)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets — for Retry-After. */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  if (buckets.size > MAX_TRACKED) sweep(now)

  const w = buckets.get(key)
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }
  w.count++
  const retryAfter = Math.max(1, Math.ceil((w.resetAt - now) / 1000))
  if (w.count > limit) return { allowed: false, remaining: 0, retryAfter }
  return { allowed: true, remaining: limit - w.count, retryAfter }
}

/**
 * Best-effort client identity.
 *
 * x-forwarded-for is caller-supplied and trivially spoofed in general; on
 * Vercel the platform overwrites it at the edge, so the LEFTMOST entry is
 * the real client for our deployment. It is used only to bucket a rate
 * limit — never for authorization, and never to build a URL. That last
 * point matters: a header-derived origin is exactly the bug this batch
 * removed from the page shells, and this must not quietly reintroduce the
 * pattern in a different file.
 */
export function clientKey(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  return headers.get('x-real-ip')?.slice(0, 64) ?? 'unknown'
}

/** Test seam. */
export function __resetRateLimit() {
  buckets.clear()
}
