'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import {
  type DataState,
  type FetchFailureReason,
  type FetchResult,
  dataState,
  isRetryable,
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

/**
 * A session named in the strip grammar the picker already uses:
 * `RACE · HUNGARORING · JUL 26`.
 */
export function sessionStripLabel(s: Session | undefined): string | null {
  if (!s) return null
  const date = new Date(s.date_start)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
  return `${s.session_name.toUpperCase()} · ${s.circuit_short_name.toUpperCase()} · ${date}`
}

type AnyFetcher = (sessionKey: number) => Promise<FetchResult<unknown>>
type Fetchers = Record<string, (sessionKey: number) => Promise<FetchResult<unknown>>>

type RowsOf<F> = {
  [K in keyof F]: F[K] extends (sessionKey: number) => Promise<FetchResult<infer T>> ? T[] : never
}

export interface SessionData<F extends Fetchers> {
  /** Last successfully loaded rows. Survives an unavailable state. */
  data: RowsOf<F> | null
  /**
   * The session key `data` actually belongs to. When an outage keeps rows
   * on screen while the user has already selected something else, this is
   * NOT the selected key — and the page must say so rather than letting the
   * new heading imply the old rows are its own.
   */
  dataKey: number | null
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

export interface SessionDataOptions<F extends Fetchers> {
  /**
   * The fetcher whose emptiness means "this session has no data".
   * Defaults to the first key in `fetchers`.
   */
  primary?: keyof F
  /**
   * Fetchers whose failure must NOT take the page down.
   *
   * The rationale this file was written on — "a session page showing five
   * panels should be able to keep four and mark one unavailable" — was not
   * actually honoured until a browser run showed it: openf1 429s
   * /session_result intermittently even for isolated, spaced requests, and
   * that one flaky enrichment call was blanking all of /results while
   * positions, drivers and pit stops had all arrived. A fetcher belongs
   * here only when its absence renders as something NEUTRAL and true — a
   * driver roster degrades an acronym to "#44", a missing gap renders "—".
   * It does NOT belong here when absence would state something false: pit
   * stop counts would read "0 STOPS", which is a claim, not a blank.
   */
  optional?: (keyof F)[]
}

/**
 * Fetch one or more per-session endpoints for `sessionKey`, ignoring any
 * response that a newer key has superseded.
 */
export function useSessionData<F extends Fetchers>(
  sessionKey: number | null,
  fetchers: F,
  options: SessionDataOptions<F> = {}
): SessionData<F> {
  const { primary, optional } = options
  const optionalSig = (optional ?? []).join(',')
  const [data, setData] = useState<RowsOf<F> | null>(null)
  const [dataKey, setDataKey] = useState<number | null>(null)
  const [result, setResult] = useState<FetchResult<unknown> | null>(null)
  const [fetching, setFetching] = useState(false)
  // True only while a backoff retry is actually scheduled — drives the
  // copy, so "RETRYING SHORTLY" is never shown once nothing will retry.
  const [retryPending, setRetryPending] = useState(false)

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

  // Retryable failures recover on their own. Measured on a cold cache:
  // /results asks for four endpoints at once and openf1 429s exactly one of
  // the burst, so without this the page sat on "RATE LIMITED — RETRYING
  // SHORTLY" while nothing retried — copy promising something the code did
  // not do. A 'blocked' lockout is NOT retried (openf1 refuses for the
  // length of the session) and its copy promises nothing.
  const RETRY_MS = [900, 2600]
  const retryTimers = useRef<number[]>([])
  const clearRetries = () => {
    retryTimers.current.forEach((t) => window.clearTimeout(t))
    retryTimers.current = []
  }

  // `optionalOnly` marks a retry that exists purely to fill in enrichment
  // after everything required already committed. Such a retry may only ever
  // IMPROVE the page: if it fails, the good data stays and no outage notice
  // appears. Without this, a background retry for /results' flaky
  // session_result could 429 on a required endpoint and flip a fully
  // rendered classification into "unavailable" — worse than not retrying.
  const run = useCallback(
    async (key: number, attempt = 0, optionalOnly = false) => {
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

      const isOptional = (name: string) => (optional ?? []).includes(name as keyof F)
      // Only a REQUIRED failure takes the page down.
      const failure = settled.find(([name, r]) => !r.ok && !isOptional(name))?.[1]
      const optionalFailed = settled.filter(([name, r]) => !r.ok && isOptional(name))
      if (failure) {
        // Keep whatever is already on screen; mark the attempt failed —
        // unless this was a background enrichment retry, which must stay
        // invisible when it does not succeed.
        if (!optionalOnly) setResult(failure)
        setFetching(false)
        const willRetry = isRetryable(failure) && attempt < RETRY_MS.length
        if (!optionalOnly) setRetryPending(willRetry)
        if (willRetry) {
          const t = window.setTimeout(() => {
            // The ticket check inside the retry drops it if the user has
            // since selected another session.
            if (gate.isCurrent(mine)) void run(key, attempt + 1, optionalOnly)
          }, RETRY_MS[attempt])
          retryTimers.current.push(t)
        }
        return
      }
      clearRetries()
      setRetryPending(false)
      // An optional fetcher that failed contributes no rows; the page's
      // neutral fallback covers it. Retry it quietly in the background so
      // the enrichment fills in without ever showing an outage notice.
      const rows = Object.fromEntries(
        settled.map(([name, r]) => [name, r.ok ? r.rows : []])
      ) as unknown as RowsOf<F>
      if (optionalFailed.length > 0 && attempt < RETRY_MS.length) {
        const retryable = optionalFailed.some(([, r]) => isRetryable(r))
        if (retryable) {
          const t = window.setTimeout(() => {
            if (gate.isCurrent(mine)) void run(key, attempt + 1, true)
          }, RETRY_MS[attempt])
          retryTimers.current.push(t)
        }
      }
      const primaryKey = (primary ?? entries[0][0]) as string
      setData(rows)
      setDataKey(key)
      setResult({ ok: true, rows: (rows as Record<string, unknown[]>)[primaryKey] })
      setFetching(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, optionalSig, gate]
  )

  useEffect(() => {
    clearRetries()
    setRetryPending(false)
    if (sessionKey === null) {
      // Selecting nothing must not leave the previous session's rows up.
      gate.abandon()
      setData(null)
      setDataKey(null)
      setResult(null)
      setFetching(false)
      return
    }
    void run(sessionKey)
    return clearRetries
    // keySig stands in for `fetchers`; see the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, keySig, run])

  const refresh = useCallback(() => {
    clearRetries()
    setRetryPending(false)
    if (sessionKey !== null) void run(sessionKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, run])

  const state = sessionKey === null ? 'empty' : dataState(result, data !== null)
  const reason = result && !result.ok ? result.reason : undefined
  const stale = Boolean(reason) && data !== null

  return {
    data,
    dataKey,
    state,
    reason,
    stale,
    fetching,
    message: reason ? unavailableMessage(reason, retryPending) : null,
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
        ? unavailableMessage(result && !result.ok ? result.reason : undefined)
        : null,
  }
}
