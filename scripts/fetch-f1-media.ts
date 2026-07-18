/**
 * Fetch official F1 imagery into public/media/ and generate
 * lib/media-manifest.ts. Re-run any time with: npm run fetch-media
 *
 * Sources (all media.formula1.com, already whitelisted):
 * - driver headshots: lib/driver-data DRIVER_PHOTOS, openf1 headshot_url
 *   as fallback for any current-grid acronym not covered
 * - car + logo images: lib/team-data TEAM_CARS / TEAM_LOGOS
 * - circuit line art: meetings.json circuit_image (carbon track icons)
 *
 * 404s and network failures are logged and skipped — this script must
 * never fail a build over a missing image.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { DRIVER_PHOTOS } from '../lib/driver-data'
import { TEAM_CARS, TEAM_LOGOS, teamToSlug } from '../lib/team-data'

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'media')

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const extOf = (url: string) => {
  const m = url.split('?')[0].match(/\.(webp|png|jpe?g|avif)$/i)
  return m ? m[1].toLowerCase() : 'png'
}

interface FetchResult {
  ok: string[]
  skipped: string[]
}

// Resolves false on failure, true on success, or the actual saved
// basename when the content forced a different extension (SVG-as-png).
async function download(url: string, dest: string): Promise<boolean | string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'lights-out-site/1.0' } })
    if (!res.ok) {
      console.log(`  skip (${res.status}): ${url}`)
      return false
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 500) {
      console.log(`  skip (tiny ${buf.length}b): ${url}`)
      return false
    }
    // The F1 CDN serves some assets as SVG under .png names — save them
    // with the real extension or the static server sends the wrong
    // content-type and the image optimizer rejects them.
    const head = buf.subarray(0, 300).toString('utf8').trimStart()
    if ((head.startsWith('<') || head.startsWith('<?xml')) && head.includes('<svg')) {
      const svgDest = dest.replace(/\.(webp|png|jpe?g|avif)$/i, '.svg')
      await writeFile(svgDest, buf)
      return path.basename(svgDest)
    }
    await writeFile(dest, buf)
    return true
  } catch (err) {
    console.log(`  skip (error): ${url} — ${(err as Error).message}`)
    return false
  }
}

async function fetchCategory(
  name: string,
  dir: string,
  entries: Array<{ key: string; url: string; file: string }>
): Promise<FetchResult & { paths: Record<string, string> }> {
  await mkdir(path.join(OUT, dir), { recursive: true })
  const ok: string[] = []
  const skipped: string[] = []
  const paths: Record<string, string> = {}
  for (const { key, url, file } of entries) {
    const good = await download(url, path.join(OUT, dir, file))
    if (good) {
      ok.push(key)
      paths[key] = `/media/${dir}/${typeof good === 'string' ? good : file}`
    } else {
      skipped.push(key)
    }
    await new Promise((r) => setTimeout(r, 120)) // be polite to the CDN
  }
  console.log(`${name}: ${ok.length} fetched, ${skipped.length} skipped`)
  return { ok, skipped, paths }
}

async function main() {
  // ── drivers ──
  const driverEntries = Object.entries(DRIVER_PHOTOS).map(([acr, url]) => ({
    key: acr,
    url,
    file: `${acr}.${extOf(url)}`,
  }))
  // openf1 fallback for acronyms not in the curated map
  try {
    const sessions = await fetch('https://api.openf1.org/v1/sessions?year=2026').then((r) =>
      r.ok ? r.json() : []
    )
    const past = (sessions as Array<{ session_key: number; date_end: string }>)
      .filter((s) => new Date(s.date_end).getTime() < Date.now())
      .sort((a, b) => new Date(b.date_end).getTime() - new Date(a.date_end).getTime())[0]
    if (past) {
      const drivers = await fetch(
        `https://api.openf1.org/v1/drivers?session_key=${past.session_key}`
      ).then((r) => (r.ok ? r.json() : []))
      for (const d of drivers as Array<{ name_acronym: string; headshot_url: string | null }>) {
        if (d.name_acronym && d.headshot_url && !DRIVER_PHOTOS[d.name_acronym]) {
          driverEntries.push({
            key: d.name_acronym,
            url: d.headshot_url,
            file: `${d.name_acronym}.${extOf(d.headshot_url)}`,
          })
        }
      }
    }
  } catch {
    console.log('  (openf1 fallback unavailable — live-session lockout?)')
  }
  const drivers = await fetchCategory('drivers', 'drivers', driverEntries)

  // ── cars (downsize the giant source renditions) ──
  const carEntries = Object.entries(TEAM_CARS).map(([team, url]) => ({
    key: teamToSlug(team),
    url: url.replace(/w_\d+/, 'w_1280'),
    file: `${teamToSlug(team)}.${extOf(url)}`,
  }))
  const cars = await fetchCategory('cars', 'cars', carEntries)

  // ── team logos ──
  const logoEntries = Object.entries(TEAM_LOGOS).map(([team, url]) => ({
    key: teamToSlug(team),
    url,
    file: `${teamToSlug(team)}-logo.${extOf(url)}`,
  }))
  const logos = await fetchCategory('logos', 'teams', logoEntries)

  // ── circuit line art (carbon icons) from the calendar ──
  const meetingsRaw = JSON.parse(await readFile(path.join(ROOT, 'meetings.json'), 'utf8')) as Array<{
    country_name: string
    circuit_image: string
    meeting_name: string
  }>
  const byCountry = new Map<string, string>()
  for (const m of meetingsRaw) {
    if (m.circuit_image && !byCountry.has(m.country_name)) {
      byCountry.set(m.country_name, m.circuit_image)
    }
  }
  const circuitEntries = [...byCountry.entries()].map(([country, url]) => ({
    key: country,
    url,
    file: `${slug(country)}.${extOf(url)}`,
  }))
  const circuits = await fetchCategory('circuits', 'circuits', circuitEntries)

  // ── manifest ──
  const manifest = `// GENERATED by scripts/fetch-f1-media.ts — do not edit by hand.
// Refresh with: npm run fetch-media

export const DRIVER_IMAGES: Record<string, string> = ${JSON.stringify(drivers.paths, null, 2)}

export const CAR_IMAGES: Record<string, string> = ${JSON.stringify(cars.paths, null, 2)}

export const TEAM_LOGO_IMAGES: Record<string, string> = ${JSON.stringify(logos.paths, null, 2)}

// keyed by country_name as it appears in the calendar data
export const CIRCUIT_IMAGES: Record<string, string> = ${JSON.stringify(circuits.paths, null, 2)}

export const driverImage = (acronym: string): string | null =>
  DRIVER_IMAGES[acronym?.toUpperCase()] ?? null

export const carImage = (teamSlug: string): string | null => CAR_IMAGES[teamSlug] ?? null

export const teamLogoImage = (teamSlug: string): string | null =>
  TEAM_LOGO_IMAGES[teamSlug] ?? null

export const circuitImage = (countryName: string): string | null =>
  CIRCUIT_IMAGES[countryName] ?? null
`
  await writeFile(path.join(ROOT, 'lib', 'media-manifest.ts'), manifest)
  console.log('manifest written: lib/media-manifest.ts')
  console.log(
    `TOTAL: drivers ${drivers.ok.length}/${driverEntries.length}, cars ${cars.ok.length}/${carEntries.length}, logos ${logos.ok.length}/${logoEntries.length}, circuits ${circuits.ok.length}/${circuitEntries.length}`
  )
  if (drivers.skipped.length) console.log('missing drivers:', drivers.skipped.join(', '))
  if (cars.skipped.length) console.log('missing cars:', cars.skipped.join(', '))
  if (logos.skipped.length) console.log('missing logos:', logos.skipped.join(', '))
  if (circuits.skipped.length) console.log('missing circuits:', circuits.skipped.join(', '))
}

main()
