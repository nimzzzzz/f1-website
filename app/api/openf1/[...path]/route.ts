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

async function fetchUpstream(url: string): Promise<string> {
  // Local verification hook (unset in prod): pretend openf1 is locked.
  if (process.env.SIMULATE_OPENF1_DOWN === '1') {
    throw new Error('simulated lockout')
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'lights-out-site/1.0' },
    cache: 'no-store',
  })
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
    return new Response('not found', { status: 404 })
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
  } catch {
    // Nothing ever cached for this key and upstream is unavailable.
    return new Response(JSON.stringify([]), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
}
