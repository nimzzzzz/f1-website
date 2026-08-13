import { describe, it, expect, vi } from 'vitest'

// THE SHARING PROPERTY, tested where it can actually be asserted.
//
// The real wrapper is unstable_cache + React cache(), and neither runs
// outside Next's server runtime — so an end-to-end test of them is not
// available here. What IS testable, and what the build measurement showed
// was actually broken, is the DEDUPE SHAPE: the old buildMemo stored the
// RESULT, so concurrent callers all missed it and all computed. One build
// worker ran sixteen full openf1 sweeps because of exactly that.
//
// These tests pin the shape the fix depends on: memoise the in-flight
// PROMISE, never cache a rejection, and re-compute after expiry.

/** The shape the real cache must have — result-memoising is the bug. */
function sharedCompute<T>(fn: () => Promise<T>, ttlMs: number, now = () => Date.now()) {
  let inflight: Promise<T> | null = null
  let value: { at: number; result: T } | null = null
  return async (): Promise<T> => {
    if (value && now() - value.at < ttlMs) return value.result
    // The in-flight promise IS the memo. Storing only the settled result
    // lets N concurrent callers all miss and all compute.
    if (inflight) return inflight
    inflight = fn()
      .then((r) => {
        value = { at: now(), result: r }
        inflight = null
        return r
      })
      .catch((e) => {
        // A failure is never cached: the completeness guard throws on an
        // incomplete season, and caching that would serve a broken
        // championship for the whole TTL.
        inflight = null
        throw e
      })
    return inflight
  }
}

describe('N consumers cost ONE compute', () => {
  it('dedupes concurrent callers to a single compute', async () => {
    let computes = 0
    let release!: (v: string) => void
    const gate = new Promise<string>((r) => (release = r))
    const load = sharedCompute(async () => {
      computes++
      return gate
    }, 60_000)

    // Ten consumers ask at once — the real shape is /api/season-data, the
    // pages, both detail routes' three entry points each, and the sitemap.
    const all = Promise.all(Array.from({ length: 10 }, () => load()))
    release('bundle')
    const results = await all

    expect(computes).toBe(1)
    expect(results).toHaveLength(10)
    expect(new Set(results).size).toBe(1)
  })

  it('the result-memo shape it replaces would NOT have deduped', async () => {
    // This is the old buildMemo, reproduced: it only helps callers that
    // start after one has finished.
    let computes = 0
    let memo: string | null = null
    const resultMemo = async () => {
      if (memo) return memo
      computes++
      await new Promise((r) => setTimeout(r, 5))
      memo = 'bundle'
      return memo
    }
    await Promise.all(Array.from({ length: 10 }, () => resultMemo()))
    expect(computes).toBe(10) // every concurrent caller computed
  })

  it('serves subsequent callers from the memo without recomputing', async () => {
    let computes = 0
    const load = sharedCompute(async () => {
      computes++
      return 'bundle'
    }, 60_000)
    await load()
    await load()
    await load()
    expect(computes).toBe(1)
  })
})

describe('failures are never cached', () => {
  it('a thrown compute is not stored, and the next caller retries', async () => {
    let computes = 0
    const load = sharedCompute(async () => {
      computes++
      if (computes === 1) throw new Error('season-data: 3/15 sessions incomplete')
      return 'bundle'
    }, 60_000)

    await expect(load()).rejects.toThrow(/incomplete/)
    // If the rejection had been cached, this would throw again rather than
    // recompute — and an incomplete season would be served for the TTL.
    await expect(load()).resolves.toBe('bundle')
    expect(computes).toBe(2)
  })

  it('concurrent callers all see the same rejection, once', async () => {
    let computes = 0
    const load = sharedCompute(async () => {
      computes++
      throw new Error('calendar fetch failed (rate-limited)')
    }, 60_000)
    const results = await Promise.allSettled([load(), load(), load()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(computes).toBe(1)
  })
})

describe('expiry', () => {
  it('recomputes once the TTL has passed, not before', async () => {
    let computes = 0
    let clock = 1_000_000
    const load = sharedCompute(
      async () => {
        computes++
        return `bundle-${computes}`
      },
      60_000,
      () => clock
    )
    expect(await load()).toBe('bundle-1')
    clock += 59_000
    expect(await load()).toBe('bundle-1') // still fresh
    expect(computes).toBe(1)
    clock += 2_000
    expect(await load()).toBe('bundle-2') // past 60s
    expect(computes).toBe(2)
  })
})
