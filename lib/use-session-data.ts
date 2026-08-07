'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import {
  type DataState,
  type FetchFailureReason,
  type FetchResult,
  dataState,
  unavailableMessage,
} from '@/lib/fetch-result'

// THE SHARED SESSION-DATA PATH.
//
// Seven pages (results, laps, positions, pit-stops, stints, weather,
// race-control) each hand-rolled the same effect: fetch on session change,
// setState when it lands. None of them cancelled, so selecting session A and
// then B raced the two responses — if A was slower (very likely: B is often
// a cache hit and A a cold fetch) A's rows landed last and the page showed A
// under B's heading, with no error and nothing to suggest anything was
// wrong. Fixing that seven times over would have left seven chances to
// regress it, so the fix lives here.
//
// A MONOTONIC REQUEST ID, not an AbortController. The underlying
// client-cache shares one in-flight promise per session key across all
// callers; aborting the signal for one consumer would reject that shared
// promise for every other consumer of the same key. The id ignores stale
// responses at the point of commit instead, which is the property that
// actually matters: only the newest request may write state. A response for
// a superseded key is dropped, not rendered.
//
// It also carries the three-state contract. `state` is 'data' | 'empty' |
// 'unavailable', and on 'unavailable' the previously loaded rows are KEPT in
// `data` (with `stale: true`) so an outage never blanks the screen and never
// claims the session has no data.

/**
 * Latest-wins gate. `start()` takes a ticket before a request goes out;
 * `isCurrent(ticket)` is false once a newer request has started, and the
 * caller must then drop its response instead of committing it.
 *
 * Exported (and separate from the hook) so the interleaving can be driven
 * deterministically in a test — the property being protected is a race, and
 * a race is not worth asserting against a re-implementation of itself.
 */
export function createLatestWins() {
  let ticket = 0
  return {
    start: () => ++ticket,
    isCurrent: (t: number) => t === ticket,
    /** Invalidate everything in flight without starting a new request. */
    abandon: () => {
      ticket++
    },
  }
}

type AnyFetcher = (sessionKey: number) => Promise<FetchResult<unknown>>
type Fetchers = Record<string, (sessionKey: number) => Promise<FetchResult<unknown>>>

type RowsOf<F> = {
  [K in keyof F]: F[K] extends (sessionKey: number) => Promise<FetchResult<infer T>> ? T[] : never
}

export interface SessionData<F extends Fetchers> {
  /** Last successfully loaded rows. Survives an unavailable state. */
  data: RowsOf<F> | null
  state: DataState
  reason: FetchFailureReason | undefined
  /** True when `data` is being shown but the latest attempt failed. */
  stale: boolean
  /** True while a request for the current key is outstanding. */
  fetching: boolean
  /** Copy for the non-'data' states; null when there is data to show. */
  message: string | null
  /** Re-run the current key (used by the unavailable state's retry). */
  refresh: () => void
}

/**
 * Fetch one or more per-session endpoints for `sessionKey`, ignoring any
 * response that a newer key has superseded.
 *
 * `primary` names the fetcher whose emptiness means "this session has no
 * data" — the others are supporting (drivers, for instance, are usually
 * present even when the panel's own rows are not). Defaults to the first
 * key in `fetchers`.
 */
export function useSessionData<F extends Fetchers>(
  sessionKey: number | null,
  fetchers: F,
  primary?: keyof F
): SessionData<F> {
  const [data, setData] = useState<RowsOf<F> | null>(null)
  const [result, setResult] = useState<FetchResult<unknown> | null>(null)
  const [fetching, setFetching] = useState(false)

  // Latest-wins. A ticket is taken per request; a response only commits if
  // its ticket is still the current one.
  const gate = useRef(createLatestWins()).current
  // fetchers is a fresh object literal on every render at every call site;
  // depending on it directly would refetch forever. The keys and the
  // identity of the functions they hold are stable in practice (they are
  // module-level exports of client-cache), so the key list is the dep.
  const fetchersRef = useRef(fetchers)
  fetchersRef.current = fetchers
  const keySig = Object.keys(fetchers).join(',')

  const run = useCallback(
    async (key: number) => {
      const mine = gate.start()
      setFetching(true)
      const entries = Object.entries(fetchersRef.current) as [string, AnyFetcher][]
      let settled: [string, FetchResult<unknown>][]
      try {
        settled = await Promise.all(
          entries.map(async ([name, fn]) => [name, await fn(key)] as [string, FetchResult<unknown>])
        )
      } catch {
        // A fetcher that threw rather than returning a failure result.
        if (!gate.isCurrent(mine)) return
        setResult({ ok: false, reason: 'network' })
        setFetching(false)
        return
      }
      // A newer session key was selected while this was in flight. Drop it:
      // committing here is exactly the bug this hook exists to prevent.
      if (!gate.isCurrent(mine)) return

      const failure = settled.find(([, r]) => !r.ok)?.[1]
      if (failure) {
        // Keep whatever is already on screen; mark the attempt failed.
        setResult(failure)
        setFetching(false)
        return
      }
      const rows = Object.fromEntries(
        settled.map(([name, r]) => [name, (r as { ok: true; rows: unknown[] }).rows])
      ) as unknown as RowsOf<F>
      const primaryKey = (primary ?? entries[0][0]) as string
      setData(rows)
      setResult({ ok: true, rows: (rows as Record<string, unknown[]>)[primaryKey] })
      setFetching(false)
    },
    [primary, gate]
  )

  useEffect(() => {
    if (sessionKey === null) {
      // Selecting nothing must not leave the previous session's rows up.
      gate.abandon()
      setData(null)
      setResult(null)
      setFetching(false)
      return
    }
    void run(sessionKey)
    // keySig stands in for `fetchers`; see the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, keySig, run])

  const refresh = useCallback(() => {
    if (sessionKey !== null) void run(sessionKey)
  }, [sessionKey, run])

  const state = sessionKey === null ? 'empty' : dataState(result, data !== null)
  const reason = result && !result.ok ? result.reason : undefined
  const stale = Boolean(reason) && data !== null

  return {
    data,
    state,
    reason,
    stale,
    fetching,
    message: reason ? unavailableMessage(reason, stale) : null,
    refresh,
  }
}

export interface SessionListState {
  sessions: Session[]
  selectedKey: number | null
  setSelectedKey: (key: number | null) => void
  loading: boolean
  state: DataState
  message: string | null
}

/**
 * The session picker's list, loaded once and shared through client-cache.
 * `filter` narrows to the page's session types; `pick` chooses the initial
 * selection from the filtered, already-sorted list.
 */
export function useSessionList(
  filter: (s: Session) => boolean,
  pick: (sorted: Session[]) => Session | undefined
): SessionListState {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [result, setResult] = useState<FetchResult<Session> | null>(null)
  const [loading, setLoading] = useState(true)

  const filterRef = useRef(filter)
  const pickRef = useRef(pick)
  filterRef.current = filter
  pickRef.current = pick

  useEffect(() => {
    let alive = true
    getCachedSessions()
      .then((res) => {
        if (!alive) return
        setResult(res)
        if (!res.ok) return
        const sorted = res.rows
          .filter((s) => filterRef.current(s))
          .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())
        setSessions(sorted)
        const initial = pickRef.current(sorted)
        if (initial) setSelectedKey(initial.session_key)
      })
      .catch(() => {
        if (alive) setResult({ ok: false, reason: 'network' })
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const state = dataState(result, sessions.length > 0)
  return {
    sessions,
    selectedKey,
    setSelectedKey,
    loading,
    state,
    message:
      state === 'unavailable'
        ? unavailableMessage(result && !result.ok ? result.reason : undefined, sessions.length > 0)
        : null,
  }
}
