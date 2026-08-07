import { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'

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
// Whitelisted read-only endpoints only — this is not an open proxy.

const ALLOWED = new Set([
  'meetings',
  'sessions',
  'drivers',
  'laps',
  'position',
  'pit',
  'stints',
  'race_control',
  'weather',
  'session_result',
  'intervals',
])

export const maxDuration = 30

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
  })
  // openf1 answers a query that matches nothing with 404
  // {"detail":"No results found."} — that is a genuinely EMPTY result, not
  // a provider failure. Relaying it as an error would make every future
  // session on the picker read "DATA TEMPORARILY UNAVAILABLE", which is the
  // same lie as the one this work exists to remove, pointing the other way.
  if (res.status === 404) return '[]'
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  const body = await res.text()
  // refuse to cache empty payloads — an empty array during a lockout
  // would overwrite good stale data on some CDNs' revalidation
  if (body.trim() === '' ) throw new Error('upstream empty body')
  return body
}

// One cache entry per full upstream URL; 60s freshness keeps live-weekend
// data current, and stale survives revalidation throws indefinitely.
const cachedFetch = unstable_cache(fetchUpstream, ['openf1-proxy-v1'], {
  revalidate: 60,
})

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const endpoint = params.path.join('/')
  if (!ALLOWED.has(endpoint)) {
    // NOT 404: the client now reads 404 as openf1's "nothing matched", so
    // a rejected endpoint would masquerade as an empty result. 400 says
    // the request itself was wrong.
    return new Response(JSON.stringify({ error: 'endpoint not allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const qs = req.nextUrl.searchParams.toString()
  const url = `https://api.openf1.org/v1/${endpoint}${qs ? `?${qs}` : ''}`
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
