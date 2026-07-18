import { unstable_cache } from 'next/cache'
import type { Session, SessionResult } from '@/lib/openf1'
import {
  getMeetings,
  getAllSessions,
  getDrivers,
  getSessionResult,
  CANCELLED_COUNTRIES,
} from '@/lib/openf1'
import type { SeasonBundle } from '@/lib/season-data'

// Server-computed season bundle: the standings pipeline runs ONCE here
// (cached 300s via unstable_cache, backed by Vercel's durable data cache)
// instead of in every visitor's browser. Incomplete computations THROW so
// they are never cached — Next's stale-while-revalidate then keeps serving
// the last complete bundle through openf1's live-session 401 lockouts.
// Only a cold cache during a lockout reports blocked.

// Cold computes fetch ~17 result sets; paced batches below keep openf1's
// burst limiter happy but need headroom beyond the default function budget.
export const maxDuration = 30

const surname = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// openf1 429s concurrent bursts (observed live: 8+ of 17 parallel result
// fetches rejected). Fetch in small batches with gaps, then retry any
// empties once — the completeness guard still rejects anything missing.
async function fetchResultsPaced(sessions: Session[]) {
  const out: { session: Session; results: SessionResult[] }[] = []
  const BATCH = 4
  for (let i = 0; i < sessions.length; i += BATCH) {
    const batch = sessions.slice(i, i + BATCH)
    const settled = await Promise.all(
      batch.map(async (s) => ({ session: s, results: await getSessionResult(s.session_key) }))
    )
    out.push(...settled)
    if (i + BATCH < sessions.length) await sleep(400)
  }
  for (const row of out) {
    if (row.results.length === 0) {
      await sleep(600)
      row.results = await getSessionResult(row.session.session_key)
    }
  }
  return out
}

function gapLabel(r: SessionResult): string {
  if (r.dnf) return 'DNF'
  if (r.dns) return 'DNS'
  if (r.dsq) return 'DSQ'
  const gap = r.gap_to_leader
  if (gap === null || gap === undefined) return '—'
  if (Array.isArray(gap)) {
    const laps = gap[0] ?? 1
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`
  }
  return `+${gap.toFixed(3)}S`
}

function winnerTime(duration: SessionResult['duration']): string | null {
  if (typeof duration !== 'number' || !isFinite(duration)) return null
  const h = Math.floor(duration / 3600)
  const m = Math.floor((duration % 3600) / 60)
  const s = (duration % 60).toFixed(3).padStart(6, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

async function computeSeasonData(): Promise<SeasonBundle> {
  const [meetings, sessions] = await Promise.all([getMeetings(), getAllSessions()])
  // apiFetch returns [] on failure — empty core data means upstream is
  // unavailable (or 401-locked): refuse to cache anything.
  if (meetings.length === 0 || sessions.length === 0) {
    throw new Error('season-data: calendar unavailable')
  }

  const now = new Date()
  const notCancelled = (s: Session) => !CANCELLED_COUNTRIES.has(s.country_name)
  const completedRaceSessions = sessions.filter(
    (s) =>
      s.session_type === 'Race' &&
      s.session_name === 'Race' &&
      new Date(s.date_end) < now &&
      notCancelled(s)
  )
  const completedSprintSessions = sessions.filter(
    (s) =>
      s.session_type === 'Race' &&
      s.session_name === 'Sprint' &&
      new Date(s.date_end) < now &&
      notCancelled(s)
  )
  const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]

  const seasonYear = sessions[0]?.year ?? meetings[0]?.year ?? null

  if (completedRaceSessions.length === 0) {
    // Genuine pre-season: a complete (empty-standings) bundle is valid.
    return {
      blocked: false,
      complete: true,
      computedAt: new Date().toISOString(),
      completedRaces: 0,
      seasonYear,
      driverStandings: [],
      teamStandings: [],
      lastRace: null,
      winnersByRound: {},
      resultsByRound: {},
      meetings,
      sessions,
    }
  }

  const latestRace = [...completedRaceSessions].sort(
    (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
  )[0]

  const drivers = await getDrivers(latestRace.session_key)
  if (drivers.length === 0) throw new Error('season-data: drivers unavailable')
  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

  // Completeness guard: EVERY completed points session must return results.
  // A single missing set would silently distort the tally, so incomplete
  // computations throw and the cache keeps the last complete bundle.
  const resultSets = await fetchResultsPaced(allPointsSessions)
  const missing = resultSets.filter((r) => r.results.length === 0)
  if (missing.length > 0) {
    throw new Error(`season-data: ${missing.length}/${resultSets.length} result sets unavailable`)
  }

  const tally = new Map<number, { points: number; wins: number; podiums: number }>()
  const teamTally = new Map<string, { colour: string; points: number; wins: number }>()
  const winnersByRound: Record<number, string> = {}
  // Per-round GP results, compact — powers per-driver season records
  // without any extra upstream fetches (the data is already in hand).
  const resultsByRound: Record<number, import('@/lib/season-data').RoundResultRow[]> = {}

  for (const d of drivers) {
    if (!tally.has(d.driver_number)) tally.set(d.driver_number, { points: 0, wins: 0, podiums: 0 })
    if (!teamTally.has(d.team_name)) {
      teamTally.set(d.team_name, { colour: d.team_colour, points: 0, wins: 0 })
    }
  }

  for (const { session, results } of resultSets) {
    const isGrandPrix = session.session_name === 'Race'
    if (isGrandPrix) {
      resultsByRound[session.meeting_key] = results.map((r) => ({
        d: r.driver_number,
        p: r.position,
        pts: r.points ?? 0,
        ...(r.dnf || r.dns || r.dsq ? { out: 1 as const } : {}),
      }))
    }
    for (const r of results) {
      const t = tally.get(r.driver_number)
      if (!t) continue
      t.points += r.points ?? 0
      if (r.position === 1) {
        if (isGrandPrix) {
          t.wins++
          const info = driverMap.get(r.driver_number)
          if (info?.full_name) winnersByRound[session.meeting_key] = surname(info.full_name)
        }
      }
      if (isGrandPrix && r.position !== null && r.position <= 3) t.podiums++
      const info = driverMap.get(r.driver_number)
      const team = info ? teamTally.get(info.team_name) : undefined
      if (team) {
        team.points += r.points ?? 0
        if (r.position === 1 && isGrandPrix) team.wins++
      }
    }
  }

  const driverStandings = [...tally.entries()]
    .map(([driverNumber, t]) => {
      const info = driverMap.get(driverNumber)
      const fullName = info?.full_name ?? `Driver #${driverNumber}`
      return {
        driverNumber,
        fullName,
        surname: surname(fullName),
        teamName: info?.team_name ?? '',
        teamColour: info?.team_colour ?? '6B7280',
        nameAcronym: info?.name_acronym ?? '---',
        ...t,
      }
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((d, i) => ({ position: i + 1, ...d }))

  const teamStandings = [...teamTally.entries()]
    .map(([teamName, t]) => ({
      teamName,
      teamColour: t.colour,
      points: t.points,
      wins: t.wins,
      driverSurnames: driverStandings
        .filter((d) => d.teamName === teamName)
        .map((d) => d.surname),
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((t, i) => ({ position: i + 1, ...t }))

  const latestResults = resultSets.find((r) => r.session.session_key === latestRace.session_key)!
  const latestMeeting = meetings.find((m) => m.meeting_key === latestRace.meeting_key)
  const podium = latestResults.results
    .filter((r) => r.position !== null && r.position <= 3)
    .sort((a, b) => (a.position ?? 9) - (b.position ?? 9))
    .map((r) => {
      const info = driverMap.get(r.driver_number)
      const fullName = info?.full_name ?? `Driver #${r.driver_number}`
      return {
        position: r.position ?? 0,
        driverNumber: r.driver_number,
        fullName,
        surname: surname(fullName),
        teamName: info?.team_name ?? '',
        teamColour: info?.team_colour ?? '6B7280',
        gapLabel: r.position === 1 ? '' : gapLabel(r),
      }
    })
  const winnerRow = latestResults.results.find((r) => r.position === 1)

  return {
    blocked: false,
    complete: true,
    computedAt: new Date().toISOString(),
    completedRaces: completedRaceSessions.length,
    seasonYear,
    driverStandings,
    teamStandings,
    lastRace: latestMeeting
      ? {
          meetingKey: latestMeeting.meeting_key,
          label: latestMeeting.meeting_name.replace(/grand prix/i, 'GP').toUpperCase(),
          winnerTime: winnerRow ? winnerTime(winnerRow.duration) : null,
          podium,
        }
      : null,
    winnersByRound,
    resultsByRound,
    meetings,
    sessions,
  }
}

// v2: bundle gained resultsByRound (per-driver season records)
const getSeasonData = unstable_cache(computeSeasonData, ['season-data-v2'], {
  revalidate: 300,
})

export async function GET() {
  try {
    const bundle = await getSeasonData()
    return Response.json(bundle, {
      headers: {
        // CDN shield: serve from edge for 5 min, stale-while-revalidate 1h
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    // No complete bundle has EVER been cached (cold start during a live
    // session) — report honestly; consumers fall back to lockout states.
    return Response.json(
      { blocked: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
