import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  type FetchResult,
  okResult,
  failResult,
  dataState,
  isRetryable,
  isBlocked,
  rowsOrEmpty,
  unavailableMessage,
} from '@/lib/fetch-result'
import { makeCache, makeSingleton } from '@/lib/client-cache'
import { isNewerBundle } from '@/lib/season-data'
import { createLatestWins, sessionStripLabel } from '@/lib/use-session-data'

// Batch 3: the site must never claim "no data" when the truth is "we could
// not ask". Each block below pins one of the four ways that lie used to get
// out: an indistinguishable failure, a cached failure, a stale memo, and an
// out-of-order response.

// ─── 1. failure vs empty ──────────────────────────────────────────────────────

describe('the fetch contract distinguishes failure from emptiness', () => {
  it('a successful empty response is DATA, not a failure', () => {
    const r = okResult<number>([])
    expect(r.ok).toBe(true)
    expect(dataState(r, false)).toBe('empty')
    expect(isRetryable(r)).toBe(false)
  })

  it('every failure mode is distinguishable from an empty success', () => {
    const modes = ['blocked', 'rate-limited', 'http', 'network', 'malformed'] as const
    for (const reason of modes) {
      const r = failResult<number>(reason)
      expect(r.ok).toBe(false)
      // The bug this replaces: all five of these used to be `[]`.
      expect(dataState(r, false)).toBe('unavailable')
      expect(dataState(r, false)).not.toBe('empty')
    }
  })

  it('a 429 is retryable; an empty session is not', () => {
    expect(isRetryable(failResult<number>('rate-limited', 429))).toBe(true)
    expect(isRetryable(failResult<number>('network'))).toBe(true)
    expect(isRetryable(failResult<number>('http', 500))).toBe(true)
    // A 401 lockout will keep refusing for the length of the session.
    expect(isRetryable(failResult<number>('blocked', 401))).toBe(false)
    expect(isRetryable(okResult<number>([]))).toBe(false)
  })

  it('flags the openf1 live-session lockout specifically', () => {
    expect(isBlocked(failResult<number>('blocked', 401))).toBe(true)
    expect(isBlocked(failResult<number>('rate-limited', 429))).toBe(false)
  })

  it('a failure with rows already on screen KEEPS showing them', () => {
    // The persistence principle: a blip must not blank the page.
    expect(dataState(failResult<number>('network'), true)).toBe('unavailable')
  })

  it('says what is happening rather than claiming emptiness', () => {
    expect(unavailableMessage('blocked')).toMatch(/LOCKED/)
    for (const reason of ['blocked', 'rate-limited', 'http', 'network', 'malformed'] as const) {
      expect(unavailableMessage(reason)).not.toMatch(/NO DATA/)
    }
  })

  it('speaks broadcast, not transport', () => {
    // A viewer does not know what rate limiting, a 429 or an HTTP status
    // is. `reason` still drives retry policy and the logs; only the lockout
    // and "is a retry scheduled" reach the screen.
    for (const reason of ['rate-limited', 'http', 'network', 'malformed'] as const) {
      for (const pending of [true, false]) {
        const msg = unavailableMessage(reason, pending)
        expect(msg).not.toMatch(/RATE LIMIT|429|HTTP|STATUS|ERROR|NETWORK|MALFORMED/)
        expect(msg).toMatch(/FEED INTERRUPTED/)
      }
    }
    // Every failure that is not a lockout reads the same to a viewer.
    expect(unavailableMessage('rate-limited', true)).toBe(unavailableMessage('network', true))
  })

  it('carries no apology', () => {
    const all = (['blocked', 'rate-limited', 'http', 'network', 'malformed'] as const).flatMap(
      (r) => [unavailableMessage(r, true), unavailableMessage(r, false)]
    )
    for (const msg of all) {
      expect(msg).not.toMatch(/SORRY|APOLOG|OOPS|PLEASE|UNFORTUNATELY/)
      expect(msg).toBe(msg.toUpperCase())
    }
  })

  it('only promises a retry while one is actually scheduled', () => {
    // Caught in the browser: the page sat on "RETRYING SHORTLY" with
    // nothing retrying. Copy must not promise what the code will not do.
    expect(unavailableMessage('rate-limited', true)).toMatch(/RECONNECTING/)
    expect(unavailableMessage('rate-limited', false)).not.toMatch(/RECONNECT/)
    expect(unavailableMessage('http', false)).not.toMatch(/RECONNECT/)
    expect(unavailableMessage('http', true)).toMatch(/RECONNECTING/)
    // A lockout never claims to be reconnecting — it is not retryable.
    expect(unavailableMessage('blocked', true)).not.toMatch(/RECONNECT/)
  })

  it('before any attempt completes the state is PENDING, not unavailable', () => {
    // Otherwise every first paint would carry an outage banner, and every
    // session with a slow first response would flash "NO DATA".
    expect(dataState(null, false)).toBe('pending')
    expect(dataState(null, false)).not.toBe('unavailable')
    expect(dataState(null, false)).not.toBe('empty')
    // With rows already on screen, keep rendering them.
    expect(dataState(null, true)).toBe('data')
  })

  it("openf1's 404 means NOTHING MATCHED — an empty answer, not a failure", () => {
    // Observed live: GET /laps?session_key=<future session> answers
    // 404 {"detail":"No results found."}. Mapping that to a failure made
    // every not-yet-run session on the picker read "TEMPORARILY
    // UNAVAILABLE" — the same lie as the original bug, pointing the other
    // way. Both fetch boundaries convert it to an empty success, so the
    // state a 404 produces is 'empty'.
    expect(dataState(okResult<number>([]), false)).toBe('empty')
    expect(isRetryable(okResult<number>([]))).toBe(false)
  })

  it('rowsOrEmpty is the explicit opt-out, not the default', () => {
    expect(rowsOrEmpty(okResult([1, 2]))).toEqual([1, 2])
    expect(rowsOrEmpty(failResult<number>('http', 500))).toEqual([])
  })
})

describe('kept rows disclose which session they came from', () => {
  const session = (key: number, name: string, circuit: string, date: string) =>
    ({
      session_key: key,
      session_name: name,
      circuit_short_name: circuit,
      date_start: date,
    }) as never

  it('names the session in the picker/strip grammar', () => {
    expect(
      sessionStripLabel(session(11342, 'Race', 'Hungaroring', '2026-07-26T14:00:00+00:00'))
    ).toBe('RACE · HUNGARORING · JUL 26')
  })

  it('is null for a session that cannot be resolved', () => {
    expect(sessionStripLabel(undefined)).toBeNull()
  })

  // The rule the pages implement: label only when the rows on screen belong
  // to a DIFFERENT session than the heading names. Same session, nothing to
  // correct — the heading is already right.
  const labelFor = (dataKey: number | null, selectedKey: number | null, s: unknown) =>
    dataKey !== null && dataKey !== selectedKey ? sessionStripLabel(s as never) : null

  it('labels the rows when the heading names a different session', () => {
    const kept = session(11342, 'Race', 'Hungaroring', '2026-07-26T14:00:00+00:00')
    expect(labelFor(11342, 11334, kept)).toBe('RACE · HUNGARORING · JUL 26')
  })

  it('adds no label when the rows match the heading', () => {
    const kept = session(11342, 'Race', 'Hungaroring', '2026-07-26T14:00:00+00:00')
    expect(labelFor(11342, 11342, kept)).toBeNull()
  })
})

// ─── 2. failures are never cached ─────────────────────────────────────────────

describe('caches store successes and never failures', () => {
  const TTL = 60_000

  it('a failed fetch does not poison the next caller', async () => {
    const calls: number[] = []
    let next: FetchResult<string> = failResult<string>('rate-limited', 429)
    const cached = makeCache<string>(async (key) => {
      calls.push(key)
      return next
    }, TTL)

    const first = await cached(7)
    expect(first.ok).toBe(false)

    // The old meetings/sessions caches wrote the [] a 429 produced and
    // served it for the next five minutes. The second call must go out.
    next = okResult(['rows'])
    const second = await cached(7)
    expect(second).toEqual({ ok: true, rows: ['rows'] })
    expect(calls).toEqual([7, 7])
  })

  it('a genuinely EMPTY success is cached — it is a real answer', async () => {
    let calls = 0
    const cached = makeCache<string>(async () => {
      calls++
      return okResult<string>([])
    }, TTL)

    await cached(1)
    await cached(1)
    expect(calls).toBe(1)
  })

  it('the same rule applies to the season-wide singleton caches', async () => {
    const seq: FetchResult<string>[] = [
      failResult<string>('blocked', 401),
      okResult(['a', 'b']),
    ]
    let calls = 0
    const cached = makeSingleton<string>(async () => seq[calls++] ?? okResult<string>([]), TTL)

    expect((await cached()).ok).toBe(false)
    expect(await cached()).toEqual({ ok: true, rows: ['a', 'b'] })
    // And now the success IS held.
    await cached()
    expect(calls).toBe(2)
  })

  it('concurrent callers share one in-flight request', async () => {
    let calls = 0
    let release!: (r: FetchResult<string>) => void
    const cached = makeCache<string>(() => {
      calls++
      return new Promise<FetchResult<string>>((res) => {
        release = res
      })
    }, TTL)

    const a = cached(3)
    const b = cached(3)
    release(okResult(['x']))
    expect(await a).toEqual(await b)
    expect(calls).toBe(1)
  })
})

// ─── 3. stale bundles are rejected against newer computedAt ───────────────────

describe('a bundle is adopted only when strictly newer', () => {
  const bundle = (computedAt: string) => ({ computedAt }) as never

  it('rejects a memoized bundle older than what is rendered', () => {
    // The long-lived-tab bug: a pre-race memo handed to a page that was
    // server-rendered with post-race data.
    expect(isNewerBundle(bundle('2026-08-07T12:00:00Z'), '2026-08-07T15:00:00Z')).toBe(false)
  })

  it('rejects an EQUAL computedAt — strictly newer means strictly', () => {
    expect(isNewerBundle(bundle('2026-08-07T12:00:00Z'), '2026-08-07T12:00:00Z')).toBe(false)
  })

  it('accepts a newer bundle', () => {
    expect(isNewerBundle(bundle('2026-08-07T15:00:00Z'), '2026-08-07T12:00:00Z')).toBe(true)
  })

  it('accepts anything when nothing is rendered yet', () => {
    expect(isNewerBundle(bundle('2026-08-07T12:00:00Z'), null)).toBe(true)
  })

  it('rejects null and unparseable timestamps', () => {
    expect(isNewerBundle(null, null)).toBe(false)
    expect(isNewerBundle(bundle('not a date'), null)).toBe(false)
  })

  it('adopts over an unparseable current value rather than freezing', () => {
    expect(isNewerBundle(bundle('2026-08-07T12:00:00Z'), 'garbage')).toBe(true)
  })
})

describe('the season-data memo expires', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const load = async () => {
    const mod = await import('@/lib/season-data')
    return mod
  }

  it('reuses one flight inside the TTL and refetches after it', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      return {
        ok: true,
        json: async () => ({ blocked: false, computedAt: '2026-08-07T12:00:00Z' }),
      }
    })
    const { fetchSeasonData, SEASON_MEMO_TTL_MS } = await load()

    await fetchSeasonData()
    await fetchSeasonData()
    expect(calls).toBe(1)

    // Before this batch there was no TTL at all: a tab open across a race
    // served the pre-race bundle for as long as it stayed open.
    vi.advanceTimersByTime(SEASON_MEMO_TTL_MS + 1)
    await fetchSeasonData()
    expect(calls).toBe(2)
  })

  it('does not memoize a failure', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      return { ok: false, json: async () => ({}) }
    })
    const { fetchSeasonData } = await load()

    await fetchSeasonData()
    await fetchSeasonData()
    expect(calls).toBe(2)
  })

  it('invalidateSeasonData drops the memo immediately', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls++
      return {
        ok: true,
        json: async () => ({ blocked: false, computedAt: '2026-08-07T12:00:00Z' }),
      }
    })
    const { fetchSeasonData, invalidateSeasonData } = await load()

    await fetchSeasonData()
    invalidateSeasonData() // what returning to a backgrounded tab triggers
    await fetchSeasonData()
    expect(calls).toBe(2)
  })
})

// ─── 4. out-of-order responses ────────────────────────────────────────────────

// createLatestWins is the gate useSessionData itself uses before every
// setState — this drives the real thing, not a copy of it. `rendered` stands
// in for the component's committed state.
describe('a superseded response never overwrites the current session', () => {
  /** Mimics one useSessionData request: take a ticket, await, commit if current. */
  function select<T>(
    gate: ReturnType<typeof createLatestWins>,
    key: number,
    response: Promise<T>,
    rendered: { key: number; value: T } | null,
    commit: (v: { key: number; value: T }) => void
  ) {
    const mine = gate.start()
    return response.then((value) => {
      if (!gate.isCurrent(mine)) return false
      commit({ key, value })
      return true
    })
  }

  it('select A, select B, A resolves LAST — B is what renders', async () => {
    const gate = createLatestWins()
    let rendered: { key: number; value: string } | null = null
    const commit = (v: { key: number; value: string }) => {
      rendered = v
    }

    // Two deferred fetches; A is the slow one.
    let resolveA!: (v: string) => void
    let resolveB!: (v: string) => void
    const A = new Promise<string>((r) => {
      resolveA = r
    })
    const B = new Promise<string>((r) => {
      resolveB = r
    })

    const flightA = select(gate, 1001, A, rendered, commit)
    const flightB = select(gate, 1002, B, rendered, commit)

    // B lands first...
    resolveB('rows for B')
    expect(await flightB).toBe(true)
    // ...then the older A finally arrives and must be DROPPED.
    resolveA('rows for A')
    expect(await flightA).toBe(false)

    expect(rendered).toEqual({ key: 1002, value: 'rows for B' })
  })

  it('in-order responses still commit normally', async () => {
    const gate = createLatestWins()
    let rendered: { key: number; value: string } | null = null
    const commit = (v: { key: number; value: string }) => {
      rendered = v
    }
    expect(await select(gate, 1, Promise.resolve('first'), rendered, commit)).toBe(true)
    expect(await select(gate, 2, Promise.resolve('second'), rendered, commit)).toBe(true)
    expect(rendered).toEqual({ key: 2, value: 'second' })
  })

  it('three interleaved selections keep only the newest', async () => {
    const gate = createLatestWins()
    let rendered: { key: number; value: string } | null = null
    const commit = (v: { key: number; value: string }) => {
      rendered = v
    }
    const defer = () => {
      let resolve!: (v: string) => void
      const p = new Promise<string>((r) => {
        resolve = r
      })
      return { p, resolve }
    }
    const a = defer()
    const b = defer()
    const c = defer()
    const fa = select(gate, 1, a.p, rendered, commit)
    const fb = select(gate, 2, b.p, rendered, commit)
    const fc = select(gate, 3, c.p, rendered, commit)

    // Resolve in the worst possible order: newest first, oldest last.
    c.resolve('C')
    expect(await fc).toBe(true)
    a.resolve('A')
    expect(await fa).toBe(false)
    b.resolve('B')
    expect(await fb).toBe(false)
    expect(rendered).toEqual({ key: 3, value: 'C' })
  })

  it('abandon() invalidates everything in flight (session deselected)', async () => {
    const gate = createLatestWins()
    let rendered: { key: number; value: string } | null = null
    const d = (() => {
      let resolve!: (v: string) => void
      const p = new Promise<string>((r) => {
        resolve = r
      })
      return { p, resolve }
    })()
    const flight = select(gate, 9, d.p, rendered, (v) => {
      rendered = v
    })
    gate.abandon()
    d.resolve('late rows')
    expect(await flight).toBe(false)
    expect(rendered).toBeNull()
  })
})
