import type { Meeting, Session } from '@/lib/openf1'

// The server-computed season bundle served by /api/season-data.
// One request replaces the ~20-endpoint client-side standings pipeline.

export interface BundleDriverStanding {
  position: number
  driverNumber: number
  fullName: string
  firstName: string
  surname: string
  teamName: string
  teamColour: string
  nameAcronym: string
  countryCode: string | null
  points: number
  wins: number
  podiums: number
}

export interface BundleTeamStanding {
  position: number
  teamName: string
  teamColour: string
  points: number
  wins: number
  driverSurnames: string[]
}

export interface BundlePodiumRow {
  position: number
  driverNumber: number
  fullName: string
  surname: string
  teamName: string
  teamColour: string
  gapLabel: string // '' for the winner
}

export interface BundleLastRace {
  meetingKey: number
  label: string // e.g. "BELGIAN GP"
  winnerTime: string | null
  podium: BundlePodiumRow[]
}

// Compact per-driver row of a grand prix result (race sessions only):
// d = driver number, p = finishing position, pts = race points, out = DNF/DNS/DSQ
export interface RoundResultRow {
  d: number
  p: number | null
  pts: number
  /** Distinct outcome. `out` is kept alongside for back-compat with any
   *  consumer that only asks "did they finish"; `st` is what should be
   *  DISPLAYED, since DNF / DNS / DSQ are different things and were
   *  previously all rendered as "DNF". */
  st?: 'DNF' | 'DNS' | 'DSQ' | 'NC'
  out?: 1
}

export interface SeasonBundle {
  blocked: false
  complete: true
  computedAt: string
  completedRaces: number
  seasonYear: number | null
  driverStandings: BundleDriverStanding[]
  teamStandings: BundleTeamStanding[]
  lastRace: BundleLastRace | null
  winnersByRound: Record<number, string> // meeting_key → winner surname
  resultsByRound: Record<number, RoundResultRow[]> // meeting_key → GP result rows
  /**
   * meeting_key → driver_number → sprint points for that round. Kept
   * SEPARATE from resultsByRound (which is grand-prix-only, and drives the
   * per-round station timeline) so a weekend's full points haul can be
   * reconciled with season totals without sprint rows appearing as extra
   * "rounds" on a driver's season line.
   */
  sprintPointsByRound: Record<number, Record<number, number>>
  meetings: Meeting[]
  sessions: Session[]
}

export interface BlockedBundle {
  blocked: true
}

export type SeasonDataResponse = SeasonBundle | BlockedBundle

// Consumers treat a bundle older than this as stale (it kept serving
// through a lockout) and show the AS OF note instead of hiding data.
export const STALE_AFTER_MS = 10 * 60 * 1000

export function bundleAsOf(bundle: SeasonBundle): string | null {
  const age = Date.now() - new Date(bundle.computedAt).getTime()
  if (!(age > STALE_AFTER_MS)) return null
  return new Date(bundle.computedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * The ONLY sanctioned way to decide whether a bundle may replace what is
 * currently on screen: its computedAt must be strictly newer.
 *
 * useLiveSnapshot already worked this way; the home and standings clients
 * did not — they adopted whatever fetchSeasonData handed them. Because that
 * memo had no TTL, a tab left open across a race could hold a pre-race
 * bundle for hours and hand it to a component that had since been
 * server-rendered with NEWER data, overwriting fresh standings with old
 * ones. Same rule, one implementation, so the two cannot drift.
 */
export function isNewerBundle(
  candidate: SeasonBundle | null | undefined,
  currentComputedAt: string | null | undefined
): candidate is SeasonBundle {
  if (!candidate) return false
  const t = Date.parse(candidate.computedAt)
  if (!Number.isFinite(t)) return false
  if (!currentComputedAt) return true
  const cur = Date.parse(currentComputedAt)
  return !Number.isFinite(cur) || t > cur
}

// How long a successful bundle may be reused without going back to the
// endpoint. The memo used to have NO expiry: it was scoped to the document,
// so a long-lived tab served the same standings for as long as it stayed
// open — across a whole race weekend, if the user never reloaded. 60s
// matches the bundle route's own ISR window, so re-fetching sooner could
// not return anything newer anyway.
export const SEASON_MEMO_TTL_MS = 60 * 1000

// One flight per TTL window, shared by every consumer on the page.
let inflight: Promise<SeasonBundle | null> | null = null
let memoizedAt = 0

/** Drop the memo so the next caller goes back to the endpoint. */
export function invalidateSeasonData(): void {
  inflight = null
  memoizedAt = 0
}

// A tab that has been in the background is exactly the tab most likely to
// be holding something stale, so returning to it drops the memo. Registered
// once, at module scope, because there is one memo to invalidate — making
// each consumer wire its own listener would be several chances to forget.
let focusHooked = false
function hookFocusInvalidation() {
  if (focusHooked || typeof window === 'undefined') return
  focusHooked = true
  const drop = () => invalidateSeasonData()
  window.addEventListener('focus', drop)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') drop()
  })
}

export function fetchSeasonData(): Promise<SeasonBundle | null> {
  hookFocusInvalidation()
  if (inflight && Date.now() - memoizedAt < SEASON_MEMO_TTL_MS) return inflight

  memoizedAt = Date.now()
  const flight: Promise<SeasonBundle | null> = fetch('/api/season-data')
    .then((res) => (res.ok ? (res.json() as Promise<SeasonDataResponse>) : null))
    .then((body) => {
      const bundle = body && !body.blocked ? body : null
      // Only successes stay memoized: a failure must not pin every later
      // consumer on this page to null — the next caller retries.
      if (!bundle && inflight === flight) invalidateSeasonData()
      return bundle
    })
    .catch(() => {
      if (inflight === flight) invalidateSeasonData()
      return null
    })
  inflight = flight
  return flight
}
