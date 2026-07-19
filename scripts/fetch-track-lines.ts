/**
 * Precompute one real racing line per 2026 circuit for the WebGL hero:
 * the fastest clean qualifying lap from the 2025 season's session at the
 * same circuit (circuit_key is stable across years), fetched from openf1
 * location telemetry, normalized + quantized into small static JSON files.
 * Re-run any time with: npm run fetch-tracks
 *
 * Zero runtime openf1 dependency: the hero reads these files only, so it
 * keeps working through live-session lockouts. Circuits with no prior
 * F1 session (Madrid in 2026) are skipped and logged — the hero falls
 * back to the static NOW section for those rounds.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'media', 'tracks')

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get<T>(query: string): Promise<T | null> {
  // openf1 rate-limits aggressively; back off and retry on 429.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://api.openf1.org/v1/${query}`, {
        headers: { 'User-Agent': 'lights-out-site/1.0' },
      })
      if (res.status === 429) {
        const wait = 15000 * (attempt + 1)
        console.log(`  429 — backing off ${wait / 1000}s: ${query.slice(0, 60)}`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        console.log(`  skip (${res.status}): ${query}`)
        return null
      }
      return (await res.json()) as T
    } catch (err) {
      console.log(`  skip (error): ${query} — ${(err as Error).message}`)
      return null
    }
  }
  console.log(`  giving up after 429s: ${query.slice(0, 60)}`)
  return null
}

interface SessionRow { session_key: number; session_name: string }
interface LapRow { driver_number: number; lap_duration: number | null; date_start: string | null }
interface LocRow { x: number; y: number }

async function fetchLine(circuitKey: number) {
  // Prefer qualifying (clean, fast laps); fall back to the race.
  let sessions = await get<SessionRow[]>(
    `sessions?year=2025&circuit_key=${circuitKey}&session_name=Qualifying`
  )
  if (!sessions?.length) {
    sessions = await get<SessionRow[]>(
      `sessions?year=2025&circuit_key=${circuitKey}&session_name=Race`
    )
  }
  const sk = sessions?.[0]?.session_key
  if (!sk) return null

  const laps = await get<LapRow[]>(`laps?session_key=${sk}`)
  if (!laps?.length) return null
  const clean = laps
    .filter((l) => l.lap_duration && l.date_start)
    .sort((a, b) => (a.lap_duration ?? 1e9) - (b.lap_duration ?? 1e9))
  const lap = clean[0]
  if (!lap) return null

  const start = new Date(lap.date_start as string)
  const end = new Date(start.getTime() + (lap.lap_duration as number) * 1000)
  const loc = await get<LocRow[]>(
    `location?session_key=${sk}&driver_number=${lap.driver_number}&date>${start.toISOString()}&date<${end.toISOString()}`
  )
  if (!loc || loc.length < 100) return null

  // Normalize to a centered unit-ish box and quantize to 3 decimals —
  // ~5KB per circuit and more precision than a screen pixel needs.
  const xs = loc.map((p) => p.x)
  const ys = loc.map((p) => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const scale = 2 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const points = loc.map((p) => [
    Math.round((p.x - cx) * scale * 1000) / 1000,
    Math.round((p.y - cy) * scale * 1000) / 1000,
  ])
  return {
    points,
    source: { year: 2025, sessionKey: sk, driver: lap.driver_number, lapDuration: lap.lap_duration },
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const meetings = JSON.parse(await readFile(path.join(ROOT, 'meetings.json'), 'utf8')) as Array<{
    circuit_key: number
    circuit_short_name: string
    meeting_name: string
  }>
  // unique race circuits (skip pre-season testing entries)
  const seen = new Set<number>()
  const circuits: Array<{ key: number; name: string }> = []
  for (const m of meetings) {
    if (m.meeting_name.toLowerCase().includes('testing')) continue
    if (seen.has(m.circuit_key)) continue
    seen.add(m.circuit_key)
    circuits.push({ key: m.circuit_key, name: m.circuit_short_name })
  }

  const force = process.argv.includes('--force')
  const paths: Record<string, string> = {}
  const missing: string[] = []
  for (const c of circuits) {
    const file = `${slug(c.name)}.json`
    const dest = path.join(OUT, file)
    // resume-friendly: keep existing lines unless --force
    if (!force) {
      try {
        await readFile(dest)
        paths[c.name] = `/media/tracks/${file}`
        console.log(`${c.name}: exists, kept`)
        continue
      } catch {}
    }
    const line = await fetchLine(c.key)
    if (line) {
      await writeFile(dest, JSON.stringify(line))
      paths[c.name] = `/media/tracks/${file}`
      console.log(`${c.name}: ${line.points.length} pts (${(JSON.stringify(line).length / 1024).toFixed(1)}KB)`)
    } else {
      missing.push(c.name)
      console.log(`${c.name}: NO LINE (no 2025 session or telemetry)`)
    }
    await sleep(1500) // pace openf1
  }

  const manifest = `// GENERATED by scripts/fetch-track-lines.ts — do not edit by hand.
// Refresh with: npm run fetch-tracks
// Real 2025 fastest-lap racing lines, keyed by circuit_short_name.

export const TRACK_LINES: Record<string, string> = ${JSON.stringify(paths, null, 2)}

export const trackLine = (circuitShortName: string): string | null =>
  TRACK_LINES[circuitShortName] ?? null
`
  await writeFile(path.join(ROOT, 'lib', 'track-lines-manifest.ts'), manifest)
  console.log(`\nTOTAL: ${Object.keys(paths).length}/${circuits.length} circuits`)
  if (missing.length) console.log('missing:', missing.join(', '))
}

main()
