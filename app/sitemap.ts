import type { MetadataRoute } from 'next'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { resolveDriverParams, resolveTeamParams } from '@/lib/static-params'
import { SITE_URL } from '@/lib/seo'

// The sitemap draws its driver and team slugs from THE SAME resolver the
// build-completeness guard uses, so the two cannot drift: if a build
// prerenders 22 drivers, the sitemap lists those same 22, fallback roster
// included. Hardcoding a second list here is exactly how a sitemap ends up
// advertising pages that no longer exist.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snap = await buildSeasonSnapshot()
  const drivers = resolveDriverParams(snap).values.map((v) => v.acronym)
  const teams = resolveTeamParams(snap).values.map((v) => v.slug)
  const now = new Date()

  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}/${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  })

  return [
    entry('/', 1, 'hourly'),
    entry('standings', 0.9, 'hourly'),
    entry('schedule', 0.8, 'daily'),
    entry('drivers', 0.8, 'daily'),
    entry('teams', 0.8, 'daily'),
    entry('results', 0.7, 'hourly'),
    ...drivers.map((a) => entry(`drivers/${a}`, 0.6, 'daily' as const)),
    ...teams.map((s) => entry(`teams/${s}`, 0.6, 'daily' as const)),
    // TELEMETRY_ROUTES are deliberately absent — they carry robots noindex
    // (see lib/seo), and a sitemap that lists pages it also asks not to be
    // indexed sends a crawler two contradictory instructions.
  ]
}
