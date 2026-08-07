'use client'

import { useEffect, useRef, useState } from 'react'
import type { SeasonBundle } from '@/lib/season-data'
import { fetchSeasonData, invalidateSeasonData, isNewerBundle } from '@/lib/season-data'

// Keeping a long-lived tab honest.
//
// A TTL on the memo and an invalidate-on-focus listener are only HALF the
// fix, and browser verification is what made that obvious: dropping the memo
// changes what the NEXT caller gets, but on a tab parked on /standings there
// is no next caller — the page fetched once on mount and never again. The
// tab would still be showing pre-race standings hours later, which is the
// exact symptom the TTL was supposed to cure.
//
// So the refetch has to be driven, not merely permitted. This hook asks
// again on mount and on every return to the tab, and hands back a bundle
// ONLY when its computedAt is strictly newer than what the caller is already
// rendering — so a memo that outlived a server render can never overwrite
// fresher SSR data, and an unchanged bundle causes no re-render at all.

export interface FreshBundle {
  /** A bundle strictly newer than what the caller already renders, or null. */
  bundle: SeasonBundle | null
  /**
   * True when the last attempt could not produce a bundle. Callers with
   * nothing to show must say THIS rather than "no standings yet" — an
   * outage is not an empty championship.
   */
  unavailable: boolean
}

export function useFreshSeasonBundle(initialComputedAt: string | null): FreshBundle {
  const [fresh, setFresh] = useState<SeasonBundle | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  // The floor a candidate must beat. Seeded from what the server rendered.
  const shownAt = useRef<string | null>(initialComputedAt)

  useEffect(() => {
    let alive = true

    const load = async () => {
      const bundle = await fetchSeasonData()
      if (!alive) return
      // fetchSeasonData answers null for a failed request AND for a
      // blocked bundle — either way we could not get an answer.
      setUnavailable(!bundle)
      if (!bundle) return
      if (!isNewerBundle(bundle, shownAt.current)) return
      shownAt.current = bundle.computedAt
      setFresh(bundle)
    }

    void load()

    // Returning to the tab is the moment a stale tab is most likely to be
    // stale. invalidateSeasonData() here rather than relying on the
    // module's own focus listener firing first — this must not depend on
    // listener registration order.
    const refresh = () => {
      invalidateSeasonData()
      void load()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { bundle: fresh, unavailable }
}
