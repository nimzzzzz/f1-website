import { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'
import { buildUpstreamUrl } from '@/lib/openf1-proxy-policy'
import { clientKey, rateLimit } from '@/lib/rate-limit'

// Browser-facing openf1 proxy with durable last-known-data semantics.
//
// Every client fetch goes through here instead of api.openf1.org directly
// (lib/openf1 BASE is browser-conditional), so session data inherits the
// same stale-while-error behavior the season bundle proved out: a
// successful fetch is cached (unstable_cache in-function + CDN
// s-maxage/stale-while-revalidate at the edge); when openf1 401-locks
// during a live session, 429s, or drops, the stale copy keeps serving and
// a page NEVER loses the data it had. Only a key that has never succeeded
// returns 503 — and the UI's plain empty states cover that honestly.
//
// Whitelisted read-only endpoints only — this is not an open proxy. The
// endpoint AND its parameters are allowlisted (lib/openf1-proxy-policy),
// and the upstream URL is reconstructed from validated values rather than
// forwarded, so the set of URLs this route can produce is finite.

export const maxDuration = 30

// Upstream must not be able to hold a request open indefinitely. 8s is
// generous against measured openf1 latency and well inside maxDuration.
const UPSTREAM_TIMEOUT_MS = 8000

// The largest response the app legitimately needs is /laps for a full race
// at ~670 KB (measured). 2 MB is ~3x that. This is a backstop against a
// pathological upstream response, not a tuning knob — anything approaching
// it means an assumption broke.
const MAX_BYTES = 2 * 1024 * 1024

// Per-client budget. A page load is ~2-6 proxy calls and the client caches
// for 3 minutes, so 60/min is far above any legitimate browsing pattern.
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

// The upstream status is carried on the thrown error so the handler can
// pass it through instead of flattening every failure to 503. Without it a
// live-session 401 lockout and a 429 burst are indistinguishable at the
// browser, and the client can only ever say "temporarily unavailable" when
// it could say which.
const STATUS_RE = /^upstream (\d{3})$/

// openf1 rate-limits by CONCURRENCY, not by rate. Measured in a real
// browser against this proxy with a cold cache: /results asks for four
// endpoints at once and openf1 429s one or two of them every time. The
// season compute already worked around this with BATCH=2 + gaps; doing the
// same here fixes it once for every page instead of per caller.
//
// This gate sits INSIDE the cached function, so a cache hit never queues —
// only genuine upstream calls are throttled, and the common path is
// untouched.
const MAX_CONCURRENT = 2
const STAGGER_MS = 120
let active = 0
const waiting: (() => void)[] = []

async function acquire() {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  active++
}

function release() {
  active--
  const next = waiting.shift()
  if (next) next()
}

async function fetchUpstream(url: string): Promise<string> {
  // Local verification hook (unset in prod): pretend openf1 is locked.
  if (process.env.SIMULATE_OPENF1_DOWN === '1') {
    throw new Error(`upstream ${process.env.SIMULATE_OPENF1_STATUS ?? '401'}`)
  }
  await acquire()
  try {
    return await fetchUpstreamInner(url)
  } finally {
    // A short stagger before the slot frees: back-to-back releases would
    // otherwise re-form the burst this gate exists to break up.
    setTimeout(release, STAGGER_MS)
  }
}

async function fetchUpstreamInner(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'lights-out-site/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  // openf1 answers a query that matches nothing with 404
  // {"detail":"No results found."} — that is a genuinely EMPTY result, not
  // a provider failure. Relaying it as an error would make every future
  // session on the picker read "DATA TEMPORARILY UNAVAILABLE", which is the
  // same lie as the one this work exists to remove, pointing the other way.
  if (res.status === 404) return '[]'
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  // Declared size first — cheap rejection before reading anything.
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > MAX_BYTES) throw new Error(`upstream oversize ${declared}`)

  // Then enforce while reading, because content-length may be absent or
  // wrong. Streaming means an oversize body is abandoned mid-flight rather
  // than fully buffered and then rejected.
  const body = await readCapped(res, MAX_BYTES)
  // refuse to cache empty payloads — an empty array during a lockout
  // would overwrite good stale data on some CDNs' revalidation
  if (body.trim() === '' ) throw new Error('upstream empty body')
  return body
}

/** Read a response body, aborting past `cap` bytes. */
async function readCapped(res: Response, cap: number): Promise<string> {
  if (!res.body) return await res.text()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > cap) {
        await reader.cancel()
        throw new Error(`upstream oversize ${total}`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const joined = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    joined.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(joined)
}

// One cache entry per full upstream URL; 60s freshness keeps live-weekend
// data current, and stale survives revalidation throws indefinitely.
const cachedFetch = unstable_cache(fetchUpstream, ['openf1-proxy-v1'], {
  revalidate: 60,
})

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
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

  const endpoint = params.path.join('/')
  // Endpoint AND parameters validated; the URL is CONSTRUCTED from the
  // validated values in canonical order, never forwarded.
  const policy = buildUpstreamUrl(endpoint, req.nextUrl.searchParams)
  if (!policy.ok) {
    // NOT 404: the client reads 404 as openf1's "nothing matched", so a
    // rejected request would masquerade as an empty result. 400 says the
    // request itself was wrong.
    return new Response(JSON.stringify({ error: policy.reason }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  const url = policy.url
  try {
    const body = await cachedFetch(url)
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        // Edge shield: fresh for 60s, then serve stale up to 7 days while
        // revalidating — a failed revalidation keeps the stale copy alive.
        'Cache-Control': 's-maxage=60, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    // Nothing ever cached for this key and upstream is unavailable. Relay
    // 401 and 429 verbatim so the client can distinguish a live-session
    // lockout and a rate limit from a generic outage; anything else is 503.
    const upstream = STATUS_RE.exec(err instanceof Error ? err.message : '')?.[1]
    const status = upstream === '401' || upstream === '429' ? Number(upstream) : 503
    return new Response(JSON.stringify({ error: 'upstream unavailable', status }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}
