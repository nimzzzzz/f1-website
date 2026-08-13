'use client'

import { useEffect, useRef, useState } from 'react'

// THE FRESHNESS INDICATOR.
//
// The lie this batch exists to kill is a page that says LIVE while its data
// is frozen. So the indicator is wired to DATA FLOW, never to the calendar:
// `flowing` is true only when the live window is open AND the last poll
// succeeded AND rows are actually held. A scheduled session is not enough to
// earn the word.
//
// THE DOT BEATS ON UPDATE, it does not animate on a loop. A CSS pulse looks
// identical whether data is arriving or the feed died twenty minutes ago —
// it is decoration pretending to be status. Here the dot flares only when
// `updatedAt` changes, so the rhythm IS the freshness: if the feed stops,
// the beating visibly stops, with nothing to read.
//
// No "AS OF" prose anywhere — that register is banned site-wide. The
// optional clock is a bare mono timestamp in strip grammar, the same
// register as the rest of the metadata line.

interface Props {
  /** The live window is open (calendar-derived). */
  live: boolean
  /** Data is genuinely flowing: window open, last poll good, rows held. */
  flowing: boolean
  /** Timestamp of the last successful load or poll. */
  updatedAt: number | null
  /** Present when the feed is failing — drives the interrupted register. */
  message?: string | null
  /** Show the mono clock beside the label. */
  showClock?: boolean
  className?: string
}

const clock = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export default function LiveBeat({
  live,
  flowing,
  updatedAt,
  message,
  showClock = true,
  className = '',
}: Props) {
  // Flare once per arrival. Keyed off the timestamp rather than a duration
  // so it cannot free-run.
  const [beat, setBeat] = useState(0)
  const lastSeen = useRef<number | null>(null)
  useEffect(() => {
    if (updatedAt === null || updatedAt === lastSeen.current) return
    lastSeen.current = updatedAt
    setBeat((n) => n + 1)
  }, [updatedAt])

  // Outside a live window this says nothing at all: freshness is only a
  // question while something is running.
  if (!live) return null

  const interrupted = !flowing

  return (
    // ANNOUNCEMENT IS KEYED TO STATE, NOT TO THE CLOCK.
    //
    // The clock changes every 25 seconds. Inside a live region that is a
    // screen reader interrupting the user three times a minute to read a
    // timestamp nobody asked for — the region would be actively hostile.
    // So the visible clock and the beating dot are aria-hidden (they are a
    // visual freshness cue), and the live region carries only the words
    // that change when the STATE changes: "Live, data updating" or "Live,
    // feed interrupted". Polite, so it waits for a pause either way.
    <span className={`label-mono inline-flex items-center gap-2.5 ${className}`}>
      <span className="sr-only" role="status" aria-live="polite">
        {interrupted ? 'Live session, feed interrupted' : 'Live session, data updating'}
      </span>
      <span
        key={beat}
        aria-hidden
        className={
          interrupted
            ? 'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)]'
            : 'live-beat inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]'
        }
      />
      <span
        aria-hidden
        className={interrupted ? 'text-[var(--text-dim)]' : 'text-[var(--accent)]'}
      >
        {interrupted ? 'LIVE · FEED INTERRUPTED' : 'LIVE'}
      </span>
      {showClock && updatedAt !== null && (
        <span aria-hidden className="tabular-nums text-[var(--text-dim)]">
          {clock(updatedAt)}
        </span>
      )}
    </span>
  )
}
