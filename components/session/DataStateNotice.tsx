'use client'

import type { DataState } from '@/lib/fetch-result'

// The three states, rendered the same way everywhere.
//
//   data        — nothing shown here; the page renders its rows
//   empty       — the request SUCCEEDED and the session genuinely has none
//   unavailable — we could not ask
//
// The distinction is the point. Pages used to print "NO DATA FOR THIS
// SESSION" whenever the array was empty, which was also what an outage, a
// rate limit and a live-session lockout produced — so the site confidently
// told the user a session was empty when the truth was that we never got an
// answer. `unavailable` says what happened and, when there are earlier rows
// still on screen, says they are the last known values rather than silently
// passing them off as current.

interface Props {
  state: DataState
  /** Copy for the unavailable state (from unavailableMessage). */
  message: string | null
  /** Copy for the genuinely-empty state, e.g. "NO LAP DATA FOR THIS SESSION". */
  emptyLabel: string
  /** True when rows from an earlier load are still rendered above/below. */
  stale?: boolean
  onRetry?: () => void
  className?: string
}

export default function DataStateNotice({
  state,
  message,
  emptyLabel,
  stale = false,
  onRetry,
  className = 'mt-16',
}: Props) {
  // Nothing to say before an attempt has completed, or when the page is
  // rendering its rows.
  if (state === 'pending') return null
  if (state === 'data' && !stale) return null

  if (state === 'empty') {
    return <p className={`label-mono ${className} text-[var(--text-dim)]`}>{emptyLabel}</p>
  }

  // unavailable — or stale data still on screen behind a failed refresh
  return (
    <div
      className={`${className} flex flex-wrap items-baseline gap-x-4 gap-y-2 border-l-2 border-[var(--accent)] pl-4`}
      role="status"
      aria-live="polite"
    >
      <p className="label-mono text-[var(--accent)]">{message ?? 'DATA TEMPORARILY UNAVAILABLE'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="label-mono text-[var(--text-dim)] underline underline-offset-4 transition-colors hover:text-[var(--text)]"
        >
          RETRY
        </button>
      )}
    </div>
  )
}
