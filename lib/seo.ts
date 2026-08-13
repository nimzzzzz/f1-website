import type { Metadata } from 'next'

// THE SITE'S SEARCH AND SHARE IDENTITY, in one place.
//
// Every canonical, sitemap entry and share card resolves from SITE_URL, so
// there is one string to change if the domain does and no route can quietly
// disagree with another.
//
// VERCEL_PROJECT_PRODUCTION_URL is the platform's own value for the
// production deployment, so previews do not advertise themselves as
// canonical — a preview claiming to be the real URL is how duplicate
// content gets indexed.
export const SITE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return 'https://f1-website-three.vercel.app'
})()

export const SITE_NAME = 'LIGHTS OUT'

/**
 * Canonical URL for a path.
 *
 * Slugs are canonicalised to LOWERCASE everywhere in this codebase
 * (/drivers/VER redirects to /drivers/ver), so canonicals must be lowercased
 * too — a canonical pointing at a URL that redirects tells a crawler the
 * page it just fetched is not the real one.
 */
export function canonical(path: string): string {
  const clean = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/g, '').toLowerCase()}`
  return `${SITE_URL}${clean}`
}

/** Per-route metadata with the canonical already attached. */
export function routeMeta(opts: {
  path: string
  title: string
  description: string
  /** Session-scoped tools that should not be indexed. */
  noindex?: boolean
}): Metadata {
  const url = canonical(opts.path)
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${opts.title} — ${SITE_NAME}`,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${opts.title} — ${SITE_NAME}`,
      description: opts.description,
    },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

// THE TELEMETRY ROUTES ARE DELIBERATELY NOT INDEXED.
//
// laps, positions, pit-stops, stints, weather and race-control are session
// SCOPED TOOLS: they render a picker and then load whichever session you
// choose from the client. There is no stable document behind them — the URL
// carries no session, so /laps is a different page every weekend and
// identical for every session in between. A crawler gets the shell, which
// is honest, because the shell IS the page until you pick something.
//
// Indexing them would put six near-identical, near-empty results in front
// of someone searching for lap times and satisfy none of them. They stay
// crawlable (follow: true) so the links out of them still count; they are
// simply not themselves search destinations. /results is the exception —
// it defaults to the most recent completed session, so it always has real
// content and a reason to be found.
export const TELEMETRY_ROUTES = [
  'laps',
  'positions',
  'pit-stops',
  'stints',
  'weather',
  'race-control',
] as const
