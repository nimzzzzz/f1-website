'use client'

import { useEffect, useState } from 'react'
import type { SeasonBundle } from '@/lib/season-data'

// Converge the page onto the freshest available snapshot, from the CLIENT.
//
// Why this exists: /drivers and /teams are static + ISR. Their HTML is built
// from a snapshot, and Vercel serves stale-while-revalidate — so the first
// visitor after a quiet period gets the OLD copy and merely *triggers* the
// regeneration that happens behind them. On a low-traffic site that means
// loading the page right after a race can show pre-race standings, and only
// the next visitor sees the update.
//
// This is emphatically NOT a request-time server fetch. It runs in the
// browser, after hydration, against the site's own cached bundle endpoint.
// The server path is untouched, so the failure that produced the "STANDINGS
// DATA IS WARMING UP" bug — a Server Component fetching its own deployment
// over HTTP, which an SSO-walled host answers with a login redirect — cannot
// be reintroduced here.
//
// The SSR'd data always remains the floor: this hook only ever returns a
// bundle that is strictly NEWER than what the page was rendered with, and
// returns null on any failure. A blocked, rate-limited or 500-ing endpoint
// therefore leaves the page exactly as server-rendered, which is the
// persistence principle the whole data layer is built on.

// The first attempt is what fixes the common case. The later two exist for
// the stale-while-revalidate case: our own request is often what kicks off
// the regeneration, so the fresh snapshot only lands a few seconds later.
// Bounded on purpose — this is convergence, not polling.
const ATTEMPTS_MS = [0, 4000, 12000]

export function useLiveSnapshot(ssrComputedAt: string | null): SeasonBundle | null {
  const [fresher, setFresher] = useState<SeasonBundle | null>(null)

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    const ssrTime = ssrComputedAt ? Date.parse(ssrComputedAt) : 0

    let settled = false // stop retrying the moment we hold something newer

    const attempt = async () => {
      if (cancelled || settled) return
      try {
        const res = await fetch('/api/season-data', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const body = (await res.json()) as SeasonBundle | { blocked: true }
        if (cancelled) return
        // A blocked or incomplete bundle is never adopted — the SSR'd data
        // is by definition the last known good, so it stays.
        if (!body || (body as { blocked?: boolean }).blocked) return
        const bundle = body as SeasonBundle
        if (!Array.isArray(bundle.driverStandings) || bundle.driverStandings.length === 0) return

        const t = Date.parse(bundle.computedAt)
        if (!Number.isFinite(t) || t <= ssrTime) return // not newer — ignore
        settled = true
        timers.forEach((id) => window.clearTimeout(id))
        setFresher((prev) => {
          const prevT = prev ? Date.parse(prev.computedAt) : ssrTime
          return t > prevT ? bundle : prev
        })
      } catch {
        // Offline, aborted, or a bad payload — keep what the server rendered.
      }
    }

    for (const delay of ATTEMPTS_MS) {
      if (delay === 0) void attempt()
      else timers.push(window.setTimeout(() => void attempt(), delay))
    }
    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [ssrComputedAt])

  return fresher
}
