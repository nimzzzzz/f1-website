import { FALLBACK_DRIVER_ACRONYMS, FALLBACK_TEAM_SLUGS } from '@/lib/roster-fallback'
import { teamToSlug } from '@/lib/team-data'
import type { SeasonBundle } from '@/lib/season-data'

// Build-time slug resolution for the two dynamic routes, with a floor.
//
// THE FAILURE THIS EXISTS TO PREVENT: generateStaticParams used to return []
// whenever the season bundle came back blocked, and Next treats an empty
// param list as a legitimate answer. The build then "succeeded" while
// silently prerendering 33 fewer pages (22 drivers + 11 teams), and because
// generateStaticParams only runs at build time, ISR could never repair it —
// those pages stayed on the dynamic path until the next deploy. Observed in
// this repo three ways, all of which poison the SAME input:
//   • Vercel Attack Challenge Mode answering the build's own
//     production-snapshot fallback with challenge HTML
//   • an SSO-walled deployment answering it with a login redirect
//   • openf1 rate-limiting the compute so the fallback is reached at all
//
// The fix is layered: prefer live data, fall back to a committed roster
// (lib/roster-fallback.ts) so pages still generate, and THROW when both are
// unusable. A loud build failure beats a quiet 33-page loss.

/** Below this, a roster is not credible for the 2026 grid. */
export const MIN_DRIVERS = 20
export const MIN_TEAMS = 10

export const ACRONYM_RE = /^[A-Z]{3}$/
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface ResolveResult<T> {
  values: T[]
  source: 'bundle' | 'fallback'
}

/**
 * Core resolver. Exported so the throw path is testable with an explicitly
 * starved fallback — the condition it guards (both sources unusable) cannot
 * otherwise be reached without corrupting the committed roster file.
 */
export function resolveSlugs<T>(
  label: string,
  fromBundle: string[],
  fallback: readonly string[],
  floor: number,
  shape: RegExp,
  toParam: (s: string) => T
): ResolveResult<T> {
  // Shape-check before counting: a poisoned source can yield entries that
  // are the right length but not slugs at all (HTML fragments, redirect
  // markup), and those must not satisfy the floor.
  const clean = [...new Set(fromBundle.filter((s) => typeof s === 'string' && shape.test(s)))]
  if (clean.length >= floor) return { values: clean.map(toParam), source: 'bundle' }

  const cleanFallback = [...new Set(fallback.filter((s) => shape.test(s)))]
  if (cleanFallback.length >= floor) {
    console.warn(
      `[static-params] ${label}: bundle yielded ${clean.length} usable entries ` +
        `(floor ${floor}) — falling back to the committed roster ` +
        `(${cleanFallback.length}). Pages still prerender; ISR will refresh their data.`
    )
    return { values: cleanFallback.map(toParam), source: 'fallback' }
  }

  throw new Error(
    `[static-params] ${label}: refusing to build. The season bundle yielded ` +
      `${clean.length} usable entries and the committed fallback yielded ` +
      `${cleanFallback.length}, both below the sanity floor of ${floor}. ` +
      `Building now would silently ship a site missing those pages. ` +
      `Check that the build's data source is not returning challenge HTML, an ` +
      `SSO redirect, or a rate-limited empty bundle, then re-run ` +
      `\`npx tsx scripts/sync-roster.ts\` if the roster itself has changed.`
  )
}

export function resolveDriverParams(
  snap: SeasonBundle | { blocked: true }
): ResolveResult<{ acronym: string }> {
  const fromBundle = snap.blocked
    ? []
    : (snap.driverStandings ?? []).map((d) => String(d.nameAcronym ?? '').toUpperCase())
  return resolveSlugs(
    'drivers',
    fromBundle,
    FALLBACK_DRIVER_ACRONYMS,
    MIN_DRIVERS,
    ACRONYM_RE,
    // canonical form is lowercase — see lib/known-slugs
    (a) => ({ acronym: a.toLowerCase() })
  )
}

export function resolveTeamParams(
  snap: SeasonBundle | { blocked: true }
): ResolveResult<{ slug: string }> {
  const fromBundle = snap.blocked
    ? []
    : (snap.teamStandings ?? []).map((t) => teamToSlug(String(t.teamName ?? '')))
  return resolveSlugs('teams', fromBundle, FALLBACK_TEAM_SLUGS, MIN_TEAMS, SLUG_RE, (s) => ({ slug: s }))
}
