import type { Driver, Meeting, Session, SessionResult } from '@/lib/openf1'
import { CANCELLED_COUNTRIES } from '@/lib/openf1'
import type { SeasonBundle } from '@/lib/season-data'

// Compute-local openf1 fetcher. The bundle route is STATIC (ISR): its
// inner fetches must be revalidate-tagged — a no-store fetch would force
// the route dynamic, and an untagged fetch would freeze at build time.
// 60s freshness means every background revalidation reads fresh data.
async function of1<T>(query: string): Promise<T[]> {
  try {
    const res = await fetch(`https://api.openf1.org/v1/${query}`, {
      headers: { 'User-Agent': 'lights-out-site/1.0' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const getMeetings = () => of1<Meeting>('meetings?year=2026')
const getAllSessions = () => of1<Session>('sessions?year=2026')
const getDrivers = (sessionKey: number) => of1<Driver>(`drivers?session_key=${sessionKey}`)
const getSessionResult = (sessionKey: number) =>
  of1<SessionResult>(`session_result?session_key=${sessionKey}`)

// Server-computed season bundle: the standings pipeline runs ONCE here
// (cached 300s via unstable_cache, backed by Vercel's durable data cache)
// instead of in every visitor's browser. Incomplete computations THROW so
// they are never cached — Next's stale-while-revalidate then keeps serving
// the last complete bundle through openf1's live-session 401 lockouts.
// Only a cold cache during a lockout has nothing to serve.
//
// Consumed by /api/season-data (client pages) AND directly by the
// server-rendered /drivers and /teams pages, which share one cache entry.

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

// openf1 numeric fields can arrive as strings after post-session data
// reprocessing — coerce before any number method (a string in .toFixed
// crashed /results on race day; here it would fail a revalidation).
const asNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function gapLabel(r: SessionResult): string {
  if (r.dnf) return 'DNF'
  if (r.dns) return 'DNS'
  if (r.dsq) return 'DSQ'
  const gap = r.gap_to_leader
  if (gap === null || gap === undefined) return '—'
  if (Array.isArray(gap)) {
    const laps = asNum(gap[0]) ?? 1
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`
  }
  const n = asNum(gap)
  return n === null ? '—' : `+${n.toFixed(3)}S`
}

function winnerTime(rawDuration: SessionResult['duration']): string | null {
  const duration = asNum(rawDuration)
  if (duration === null) return null
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
        firstName: info?.first_name ?? fullName.split(/\s+/)[0] ?? '',
        surname: surname(fullName),
        teamName: info?.team_name ?? '',
        teamColour: info?.team_colour ?? '6B7280',
        nameAcronym: info?.name_acronym ?? '---',
        countryCode: info?.country_code ?? null,
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

// The route that serves this is STATIC with ISR (revalidate: 300): the
// bundle is generated at build time and refreshed in the background — a
// user request NEVER runs this compute inline. On a revalidation failure
// we THROW so Next keeps serving the last good snapshot; at build time
// (openf1 may be locked or flaky) we never throw — a blocked placeholder
// ships and the first background revalidation replaces it.
export async function buildSeasonSnapshot(): Promise<SeasonBundle | { blocked: true }> {
  try {
    return await computeSeasonData()
  } catch (err) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return { blocked: true }
    }
    throw err
  }
}
