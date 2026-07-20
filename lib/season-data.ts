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

// One flight per page load, shared by every consumer on the page.
let inflight: Promise<SeasonBundle | null> | null = null

export function fetchSeasonData(): Promise<SeasonBundle | null> {
  if (!inflight) {
    inflight = fetch('/api/season-data')
      .then((res) => (res.ok ? (res.json() as Promise<SeasonDataResponse>) : null))
      .then((body) => {
        const bundle = body && !body.blocked ? body : null
        // Only successes are memoized: a failure must not pin every later
        // consumer on this page to null — the next caller retries.
        if (!bundle) inflight = null
        return bundle
      })
      .catch(() => {
        inflight = null
        return null
      })
  }
  return inflight
}
