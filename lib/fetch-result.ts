// The fetcher contract.
//
// apiFetch used to return T[] for EVERYTHING: a 401 lockout, a 429, a 500,
// a malformed body and a network failure all became []. Two consequences
// this codebase actually hit:
//
//   • Pages said "NO DATA FOR THIS SESSION" when the real cause was an
//     outage. That is a lie to the user, and it violates the persistence
//     principle: last-known data should stay on screen.
//   • Retry logic could not tell "the API is rate-limiting me" from "this
//     session genuinely has no rows", so the season compute had to treat
//     EMPTY as retryable — retrying sessions that were simply empty, and
//     having no way to be more patient with the ones that were throttled.
//
// A discriminated union was chosen over throwing because most callers want
// to degrade rather than unwind: a session page showing five panels should
// be able to keep four and mark one unavailable. Throwing would force
// try/catch at every one of those seams and tempt callers back into
// swallowing the error. The union makes the failure a value you must
// destructure past, and `reason` is specific enough to drive both retry
// policy and user-facing copy.

export type FetchFailureReason =
  /** openf1 401s every request while a session is live. */
  | 'blocked'
  /** 429 — back off and retry; NOT an empty session. */
  | 'rate-limited'
  /** any other non-2xx. */
  | 'http'
  /** DNS, TLS, offline, CORS — fetch itself rejected. */
  | 'network'
  /** 2xx whose body was not the array we expect. */
  | 'malformed'

export type FetchResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; reason: FetchFailureReason; status?: number }

export const okResult = <T>(rows: T[]): FetchResult<T> => ({ ok: true, rows })
export const failResult = <T>(reason: FetchFailureReason, status?: number): FetchResult<T> => ({
  ok: false,
  reason,
  status,
})

/** Rows on success, [] on failure — for callers that genuinely cannot act. */
export const rowsOrEmpty = <T>(r: FetchResult<T>): T[] => (r.ok ? r.rows : [])

/** True when retrying could plausibly succeed. A genuinely empty 200 is not retryable. */
export const isRetryable = <T>(r: FetchResult<T>): boolean =>
  !r.ok && (r.reason === 'rate-limited' || r.reason === 'network' || r.reason === 'http')

/** True when the failure is openf1's live-session lockout. */
export const isBlocked = <T>(r: FetchResult<T>): boolean => !r.ok && r.reason === 'blocked'

/**
 * The three states every data surface must be able to render, plus the
 * fourth that is not a state at all:
 *   data        — we have rows
 *   empty       — the request SUCCEEDED and there genuinely are none
 *   unavailable — we could not ask; keep whatever is on screen and say so
 *   pending     — no attempt has completed yet. Says NOTHING. It exists so
 *                 that "haven't asked" cannot be reported as "asked and
 *                 failed" — which would put an outage banner on every first
 *                 paint — nor as "asked and it was empty".
 */
export type DataState = 'data' | 'empty' | 'unavailable' | 'pending'

export function dataState<T>(r: FetchResult<T> | null, hadPrevious: boolean): DataState {
  if (r === null) return hadPrevious ? 'data' : 'pending'
  if (!r.ok) return 'unavailable'
  return r.rows.length > 0 ? 'data' : 'empty'
}

/**
 * User-facing copy for an unavailable state.
 *
 * The copy must never promise something the code will not do. "RETRYING
 * SHORTLY" is only shown while a retry is genuinely scheduled — once the
 * backoff is exhausted the line changes and the RETRY control beside it is
 * the only thing that will act.
 */
export function unavailableMessage(
  reason: FetchFailureReason | undefined,
  stale: boolean,
  retryPending = false
): string {
  const base =
    reason === 'blocked'
      ? 'LIVE SESSION — TIMING DATA IS LOCKED'
      : reason === 'rate-limited'
        ? retryPending
          ? 'RATE LIMITED — RETRYING SHORTLY'
          : 'RATE LIMITED — TRY AGAIN IN A MOMENT'
        : retryPending
          ? 'DATA TEMPORARILY UNAVAILABLE — RETRYING'
          : 'DATA TEMPORARILY UNAVAILABLE'
  return stale ? `${base} · SHOWING LAST KNOWN` : base
}
