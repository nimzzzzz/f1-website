import type { Session } from '@/lib/openf1'

// WHEN IS A SESSION LIVE?
//
// The calendar is the only reliable signal, and deliberately so. The
// tempting alternative — infer "live" from the data itself — fails exactly
// when it matters: openf1 401-locks its timing endpoints FOR THE DURATION
// OF A LIVE SESSION, so during a race the data says "nothing" while the
// session is at its most live. Any data-derived test would therefore switch
// polling OFF at the start of the race and back on at the end. date_start
// and date_end come from the season bundle, which is durable across
// lockouts, so they keep answering when nothing else does. This is the same
// reasoning that already lets NowSection show RACE IN PROGRESS while the
// feed is locked.
//
// Two margins around the scheduled window, both earning their place:

/**
 * Start polling slightly BEFORE the scheduled start. Formation-lap and
 * pre-session race-control traffic (grid penalties, weather calls, pit-lane
 * open) arrives before lights out, and a session that starts a minute early
 * should not be met with a frozen page.
 */
export const LIVE_LEAD_MS = 5 * 60 * 1000

/**
 * Keep polling AFTER the scheduled end. Scheduled end is not actual end: a
 * race with red flags or a late safety car overruns routinely, and the
 * classification, final gaps and post-session race control land minutes
 * after the flag — which is precisely the data /results exists to show. A
 * short tail also covers a session whose end time upstream is approximate.
 *
 * 20 minutes is chosen against the failure it prevents: a page that stops
 * polling at the scheduled flag shows a race frozen mid-order and never
 * reaches the final classification, which is the most visible possible
 * version of the bug this batch exists to kill.
 */
export const LIVE_TAIL_MS = 20 * 60 * 1000

/** True while `session` is inside its live window (lead + scheduled + tail). */
export function isSessionLive(session: Session | undefined | null, now = Date.now()): boolean {
  if (!session) return false
  const start = new Date(session.date_start).getTime()
  const end = new Date(session.date_end).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  return now >= start - LIVE_LEAD_MS && now < end + LIVE_TAIL_MS
}

/**
 * True only while the session is genuinely under way — no lead, no tail.
 * This is what the picker's LIVE dot and NowSection's IN PROGRESS use; it
 * answers "is the session running", which is a different question from
 * "should we be polling".
 */
export function isSessionRunning(session: Session | undefined | null, now = Date.now()): boolean {
  if (!session) return false
  const start = new Date(session.date_start).getTime()
  const end = new Date(session.date_end).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  return now >= start && now < end
}

/**
 * Milliseconds until `session` next changes live-window state, so a page can
 * wake exactly once at the boundary instead of polling a clock. Returns null
 * when there is no future transition.
 */
export function msUntilLiveChange(session: Session | undefined | null, now = Date.now()): number | null {
  if (!session) return null
  const start = new Date(session.date_start).getTime()
  const end = new Date(session.date_end).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const openAt = start - LIVE_LEAD_MS
  const closeAt = end + LIVE_TAIL_MS
  if (now < openAt) return openAt - now
  if (now < closeAt) return closeAt - now
  return null
}

// ─── POLL INTERVALS ──────────────────────────────────────────────────────
//
// Each sits at or just above that endpoint's proxy TTL (ENDPOINT_TTL in
// openf1-proxy-policy). Polling faster than the cache cannot return new
// data, so the margin is what makes each poll capable of seeing something.
//
// Chosen per data type rather than one number for everything:
//
//   race control  Flags, incidents, penalties and safety cars arrive at
//                 unpredictable moments and are the reason someone watches
//                 this page during a race. Fastest tier.
//   positions     The running order changes continuously; this is the other
//                 genuinely live view.
//   laps          A new row per driver per lap (~90s), so 35s cannot miss
//                 one, and the page shows aggregates rather than a ticker.
//   pit stops     Discrete events, and already visible via the order.
//   stints        Change only when someone pits.
//   weather       openf1 publishes roughly per minute and it moves slowly.
//   session result Mostly empty until the flag; it matters at the END of the
//                 window, which the 20-minute tail exists to cover.
//   drivers       ABSENT ON PURPOSE. The roster is fixed for a session, so
//                 polling it during a race is pure cost for data that
//                 cannot change.
export const POLL_FAST = 25_000
export const POLL_MEDIUM = 35_000
export const POLL_SLOW = 60_000
