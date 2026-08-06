import { DRIVER_IMAGES } from '@/lib/media-manifest'
import { DRIVER_PHOTOS } from '@/lib/driver-data'
import { TEAM_COLOURS, teamToSlug } from '@/lib/team-data'

// Static known-sets for the two dynamic routes, used to reject unknown
// slugs WITHOUT touching the season pipeline.
//
// Why this exists: notFound() called inside the page's <Suspense> child
// runs after the response has already begun streaming, so Next cannot
// change the status — an unknown slug returned HTTP 200 with not-found
// markup (a soft 404) *after* awaiting the season snapshot. Validating
// here, synchronously, in the page component and before the Suspense
// boundary, makes notFound() throw before anything streams, so the
// response is a real 404 and no season computation happens at all.
//
// Both sets are static and require no fetch:
//   drivers — curated DRIVER_PHOTOS ∪ generated DRIVER_IMAGES (the media
//             manifest, which is regenerated from the live grid by
//             `npm run fetch-media`)
//   teams   — TEAM_COLOURS keys, slugified the same way every link is
//
// TRADE-OFF, stated plainly: a driver who joins the grid but is not yet in
// either map would 404 until the media manifest is refreshed. That is why
// the in-Suspense notFound() is KEPT as a safety net rather than removed —
// this guard only ever rejects, it never authorises, so the bundle stays
// the final authority for anything that gets past it.

const DRIVER_ACRONYMS: ReadonlySet<string> = new Set(
  [...Object.keys(DRIVER_IMAGES), ...Object.keys(DRIVER_PHOTOS)].map((a) => a.toUpperCase())
)

const TEAM_SLUGS: ReadonlySet<string> = new Set(Object.keys(TEAM_COLOURS).map(teamToSlug))

/** Canonical (lowercase) driver path segment, or null if the acronym is unknown. */
export function canonicalDriverSlug(raw: string): string | null {
  const acr = decodeURIComponent(raw).trim().toUpperCase()
  return DRIVER_ACRONYMS.has(acr) ? acr.toLowerCase() : null
}

/** Canonical (lowercase) team path segment, or null if the slug is unknown. */
export function canonicalTeamSlug(raw: string): string | null {
  const slug = decodeURIComponent(raw).trim().toLowerCase()
  return TEAM_SLUGS.has(slug) ? slug : null
}

export const knownDriverCount = () => DRIVER_ACRONYMS.size
export const knownTeamCount = () => TEAM_SLUGS.size
