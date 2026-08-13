'use client'

import type { DataState } from '@/lib/fetch-result'

// The three states, rendered the same way everywhere.
//
//   data        — nothing shown here; the page renders its rows
//   empty       — the request SUCCEEDED and the session genuinely has none
//   unavailable — we could not ask
//   pending     — no attempt has completed; says nothing
//
// The distinction is the point. Pages used to print "NO DATA FOR THIS
// SESSION" whenever the array was empty, which was also what an outage, a
// rate limit and a live-session lockout produced — so the site confidently
// told the user a session was empty when the truth was that we never got an
// answer.
//
// WHOSE ROWS ARE THESE. When an outage keeps last-known rows on screen and
// the user has already selected a different session, the page heading names
// the NEW session while the rows below belong to the old one. A status line
// reading "SHOWING LAST KNOWN" admitted the rows were stale but never said
// stale FROM WHAT, so the heading was still free to imply they were its own.
// `staleLabel` names the session the rows actually came from, and it sits
// against the rows rather than in the feed's status line — the status line
// is about the feed, this is a fact about the data.

interface Props {
  state: DataState
  /** Copy for the unavailable state (from unavailableMessage). */
  message: string | null
  /** Copy for the genuinely-empty state, e.g. "NO LAP DATA FOR THIS SESSION". */
  emptyLabel: string
  /** True when rows from an earlier load are still rendered below. */
  stale?: boolean
  /**
   * The session those kept rows belong to, in strip grammar
   * (`RACE · HUNGARORING · JUL 26`). Null when the rows belong to the
   * session already named in the heading, so there is nothing to correct.
   */
  staleLabel?: string | null
  onRetry?: () => void
  className?: string
}

export default function DataStateNotice({
  state,
  message,
  emptyLabel,
  stale = false,
  staleLabel = null,
  onRetry,
  className = 'mt-16',
}: Props) {
  // Nothing to say before an attempt has completed, or when the page is
  // rendering rows that belong to the session in the heading.
  if (state === 'pending') return null
  if (state === 'data' && !stale) return null

  if (state === 'empty') {
    return <p className={`label-mono ${className} text-[var(--text-dim)]`}>{emptyLabel}</p>
  }

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-l-2 border-[var(--accent)] pl-4">
        <p className="label-mono text-[var(--accent-text)]">{message ?? 'FEED INTERRUPTED'}</p>
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
      {stale && (
        <p className="label-mono mt-5 border-t border-[var(--line)] pt-4 text-[var(--text-dim)]">
          LAST KNOWN{staleLabel ? ` — ${staleLabel}` : ''}
        </p>
      )}
    </div>
  )
}
