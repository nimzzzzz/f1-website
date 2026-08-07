import type { Driver, Meeting, Session, SessionResult } from '@/lib/openf1'
import { isCancelled, getSessionResultsForMeeting, getDriversForMeeting } from '@/lib/openf1'
import { resultStatus } from '@/lib/openf1-normalize'
import { sortByCountback } from '@/lib/countback'
import type { SeasonBundle } from '@/lib/season-data'
import { type FetchResult, okResult, failResult, isRetryable } from '@/lib/fetch-result'

// Compute-local openf1 fetcher. The bundle route is STATIC (ISR): its
// inner fetches must be revalidate-tagged — a no-store fetch would force
// the route dynamic, and an untagged fetch would freeze at build time.
// 60s freshness means every background revalidation reads fresh data.
// OPENF1_BASE_URL: test hook (unset in prod) — lets local builds/servers
// simulate an openf1 outage by pointing at a dead port.
const OF1_BASE = process.env.OPENF1_BASE_URL ?? 'https://api.openf1.org/v1'

// Same FetchResult contract as lib/openf1: a 401, a 429 and an empty
// calendar are three different things and the log line below says which.
async function of1<T>(query: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(`${OF1_BASE}/${query}`, {
      headers: { 'User-Agent': 'lights-out-site/1.0' },
      next: { revalidate: 60 },
    })
    if (res.status === 401) return failResult<T>('blocked', 401)
    if (res.status === 429) return failResult<T>('rate-limited', 429)
    // 404 is openf1's "nothing matched" — an empty answer, not a failure.
    if (res.status === 404) return okResult<T>([])
    if (!res.ok) return failResult<T>('http', res.status)
    const data = await res.json()
    if (!Array.isArray(data)) return failResult<T>('malformed', res.status)
    return okResult(data as T[])
  } catch {
    return failResult<T>('network')
  }
}

const getMeetings = () => of1<Meeting>('meetings?year=2026')
const getAllSessions = () => of1<Session>('sessions?year=2026')

// Server-computed season bundle: the standings pipeline runs ONCE here
// instead of in every visitor's browser. Caching is Next's, at two layers:
// the consuming routes' Full Route Cache (ISR, 60s) and the Data Cache on
// the openf1 fetches below (also 60s). There is no unstable_cache here —
// an older comment claimed there was; the only unstable_cache in the repo
// wraps the openf1 proxy route. Incomplete computations THROW so
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
/**
 * One sweep per MEETING, fetching that weekend's results and roster, then
 * splitting both by session_key.
 *
 * Per-session attribution needs a roster per session as well as results per
 * session. Fetched per session that is 2 requests × 15 sessions = 30, which
 * measurably trips openf1's rate limit (a burst of 8 returns 429 for four;
 * the compute failed with "3/15 sessions incomplete" on sessions that serve
 * 22 rows perfectly when asked politely). meeting_key collapses a weekend
 * into one call each, so 15 points sessions cost 2 × 11 meetings = 22.
 *
 * RETRIES KEY ON FAILURE, NOT ON EMPTINESS. They used to key on emptiness
 * because a 429 was indistinguishable from an empty body through apiFetch's
 * old return-[] contract — so a meeting that genuinely had no rows was
 * re-fetched three times with backoff before the completeness guard rejected
 * it anyway, while a rate-limited one got exactly the same treatment by
 * accident. FetchResult now says which happened: only rate-limited /
 * network / http are retried. A 401 lockout is not retryable (openf1 will
 * keep refusing for the length of the session) and a successful empty is an
 * answer, not a miss.
 */
async function fetchSeasonRows(pointsSessions: Session[]) {
  const meetingKeys = [...new Set(pointsSessions.map((s) => s.meeting_key))]
  const BATCH = 2
  const GAP = 500

  const results = new Map<number, FetchResult<SessionResult>>()
  const rosters = new Map<number, FetchResult<Driver>>()

  const sweep = async (keys: number[]) => {
    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (mk) => {
          const [res, drv] = await Promise.all([
            getSessionResultsForMeeting(mk),
            getDriversForMeeting(mk),
          ])
          results.set(mk, res)
          rosters.set(mk, drv)
        })
      )
      if (i + BATCH < keys.length) await sleep(GAP)
    }
  }
  await sweep(meetingKeys)

  const needsRetry = (r: FetchResult<unknown> | undefined) => r === undefined || isRetryable(r)

  for (const delay of [800, 1600, 3000]) {
    const failed = meetingKeys.filter(
      (mk) => needsRetry(results.get(mk)) || needsRetry(rosters.get(mk))
    )
    if (failed.length === 0) break
    console.warn(`[season-data] retrying ${failed.length} failed meeting(s) in ${delay}ms`)
    await sleep(delay)
    for (const mk of failed) {
      if (needsRetry(results.get(mk))) results.set(mk, await getSessionResultsForMeeting(mk))
      await sleep(250)
      if (needsRetry(rosters.get(mk))) rosters.set(mk, await getDriversForMeeting(mk))
      await sleep(250)
    }
  }

  // Anything still failing is reported by reason so a lockout reads
  // differently from a throttle in the build/server log.
  const stillFailing = meetingKeys.filter(
    (mk) => results.get(mk)?.ok === false || rosters.get(mk)?.ok === false
  )
  if (stillFailing.length > 0) {
    const reasons = stillFailing.map((mk) => {
      const r = results.get(mk)
      const d = rosters.get(mk)
      const why = (!r?.ok && r?.reason) || (!d?.ok && d?.reason) || 'unknown'
      return `${mk}:${why}`
    })
    console.warn(`[season-data] ${stillFailing.length} meeting(s) unavailable — ${reasons.join(' ')}`)
  }

  const rowsOf = <T>(r: FetchResult<T> | undefined): T[] => (r && r.ok ? r.rows : [])

  // split by session
  const resultSets = pointsSessions.map((session) => ({
    session,
    results: rowsOf(results.get(session.meeting_key)).filter(
      (r) => r.session_key === session.session_key
    ),
  }))
  const rosterBySession = new Map<number, Map<number, Driver>>()
  for (const session of pointsSessions) {
    const rows = rowsOf(rosters.get(session.meeting_key)).filter(
      (d) => d.session_key === session.session_key
    )
    rosterBySession.set(session.session_key, new Map(rows.map((d) => [d.driver_number, d])))
  }
  return { resultSets, rosters: rosterBySession }
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
  const [meetingsRes, sessionsRes] = await Promise.all([getMeetings(), getAllSessions()])
  // A FAILED calendar fetch and a genuinely empty calendar both mean we
  // cannot compute — but they are reported differently, and throwing keeps
  // either out of the cache so stale-while-revalidate serves the last good
  // bundle.
  if (!meetingsRes.ok || !sessionsRes.ok) {
    const why = (!meetingsRes.ok && meetingsRes.reason) || (!sessionsRes.ok && sessionsRes.reason)
    throw new Error(`season-data: calendar fetch failed (${why})`)
  }
  const meetings = meetingsRes.rows
  const sessions = sessionsRes.rows
  if (meetings.length === 0 || sessions.length === 0) {
    throw new Error('season-data: calendar empty')
  }

  const now = new Date()
  // Per-MEETING cancellation. The old country filter also removed the
  // Bahrain GP replacement round held in Kuala Lumpur, which shares
  // country_name with the cancelled Sakhir round.
  const notCancelled = (s: Session) => !isCancelled(s)
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
      sprintPointsByRound: {},
      meetings,
      sessions,
    }
  }

  const latestRace = [...completedRaceSessions].sort(
    (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
  )[0]

  // ── per-session rosters ──────────────────────────────────────────────
  // Fetched for every points session, not just the latest race.
  const { resultSets, rosters } = await fetchSeasonRows(allPointsSessions)
  const latestRoster = rosters.get(latestRace.session_key)
  if (!latestRoster || latestRoster.size === 0) throw new Error('season-data: drivers unavailable')

  // ── completeness that means something ────────────────────────────────
  // "at least one row" used to pass, so a partial post-race publish could
  // bake in as final. A session is complete only when its result set has a
  // row per competitor ON THAT SESSION'S ROSTER, no duplicate drivers, and
  // no driver missing from the roster it is attributed through. Rows are
  // already shape-validated at the boundary (lib/openf1-normalize), so an
  // undercount here means genuinely missing data, not malformed data.
  const incomplete: string[] = []
  for (const { session, results } of resultSets) {
    const roster = rosters.get(session.session_key)
    const expected = roster?.size ?? 0
    if (expected === 0) {
      incomplete.push(`${session.session_key}: roster unavailable`)
      continue
    }
    if (results.length === 0) {
      incomplete.push(`${session.session_key}: no results`)
      continue
    }
    const uniq = new Set(results.map((r) => r.driver_number))
    if (uniq.size !== results.length) {
      incomplete.push(`${session.session_key}: ${results.length - uniq.size} duplicate driver rows`)
      continue
    }
    if (results.length < expected) {
      incomplete.push(`${session.session_key}: ${results.length}/${expected} competitors`)
      continue
    }
    const unknown = [...uniq].filter((n) => !roster!.has(n))
    if (unknown.length > 0) {
      incomplete.push(`${session.session_key}: ${unknown.length} rows not on the roster`)
    }
  }
  if (incomplete.length > 0) {
    throw new Error(
      `season-data: ${incomplete.length}/${resultSets.length} sessions incomplete — ${incomplete.join('; ')}`
    )
  }

  // ── tallies ──────────────────────────────────────────────────────────
  // Driver identity follows the DRIVER (their latest known record supplies
  // name and current team for display); points follow the driver across
  // teams. Constructor points accrue to whichever team the driver actually
  // drove for IN THAT ROUND.
  const tally = new Map<number, { points: number; wins: number; podiums: number; finishes: number[] }>()
  const teamTally = new Map<string, { colour: string; points: number; wins: number; finishes: number[] }>()
  const winnersByRound: Record<number, string> = {}
  const resultsByRound: Record<number, import('@/lib/season-data').RoundResultRow[]> = {}
  const sprintPointsByRound: Record<number, Record<number, number>> = {}

  // Display identity: the most recent session in which each driver appeared.
  const driverMap = new Map<number, Driver>()
  for (const { session } of [...resultSets].sort(
    (a, b) => new Date(a.session.date_start).getTime() - new Date(b.session.date_start).getTime()
  )) {
    for (const [num, d] of rosters.get(session.session_key) ?? []) driverMap.set(num, d)
  }
  for (const [num, d] of driverMap) {
    if (!tally.has(num)) tally.set(num, { points: 0, wins: 0, podiums: 0, finishes: [] })
    if (!teamTally.has(d.team_name)) teamTally.set(d.team_name, { colour: d.team_colour, points: 0, wins: 0, finishes: [] })
  }
  // Any team that fielded a car in ANY round must exist in the table, even
  // if its only driver has since moved on.
  for (const roster of rosters.values()) {
    for (const d of roster.values()) {
      if (!teamTally.has(d.team_name)) teamTally.set(d.team_name, { colour: d.team_colour, points: 0, wins: 0, finishes: [] })
      if (!tally.has(d.driver_number)) tally.set(d.driver_number, { points: 0, wins: 0, podiums: 0, finishes: [] })
    }
  }

  for (const { session, results } of resultSets) {
    const isGrandPrix = session.session_name === 'Race'
    const roster = rosters.get(session.session_key)!
    if (isGrandPrix) {
      resultsByRound[session.meeting_key] = results.map((r) => {
        const st = resultStatus(r)
        return {
          d: r.driver_number,
          p: r.position,
          pts: r.points ?? 0,
          // Distinct outcome preserved — DNF/DNS/DSQ are different things
          // and were previously all displayed as "DNF". `out` stays for
          // consumers that only ask "did they finish".
          ...(st !== 'classified' ? { st, out: 1 as const } : {}),
        }
      })
    } else {
      // Sprint: points only, keyed by meeting, so season totals and the
      // per-weekend haul agree.
      const bucket = (sprintPointsByRound[session.meeting_key] ??= {})
      for (const r of results) {
        if ((r.points ?? 0) > 0) bucket[r.driver_number] = (bucket[r.driver_number] ?? 0) + (r.points ?? 0)
      }
    }
    for (const r of results) {
      const t = tally.get(r.driver_number)
      if (!t) continue
      t.points += r.points ?? 0
      const classified = resultStatus(r) === 'classified' && r.position !== null
      if (isGrandPrix && classified) {
        t.finishes.push(r.position as number)
        if (r.position === 1) {
          t.wins++
          const info = roster.get(r.driver_number) ?? driverMap.get(r.driver_number)
          if (info?.full_name) winnersByRound[session.meeting_key] = surname(info.full_name)
        }
        if ((r.position as number) <= 3) t.podiums++
      }
      // ATTRIBUTION: this session's roster, not the latest one.
      const info = roster.get(r.driver_number)
      const team = info ? teamTally.get(info.team_name) : undefined
      if (team) {
        team.points += r.points ?? 0
        if (isGrandPrix && classified) {
          team.finishes.push(r.position as number)
          if (r.position === 1) team.wins++
        }
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
  // FIA countback: points, then most wins, then most seconds, then thirds…
  // The old `points, then wins` left genuine ties in upstream fetch order.
  const driverStandingsSorted = sortByCountback(driverStandings, (d) => d.driverNumber).map(
    (d, i) => {
      const { finishes: _f, ...rest } = d
      return { position: i + 1, ...rest }
    }
  )

  const teamStandingsRaw = [...teamTally.entries()]
    .map(([teamName, t]) => ({
      teamName,
      teamColour: t.colour,
      points: t.points,
      wins: t.wins,
      finishes: t.finishes,
      driverSurnames: driverStandingsSorted
        .filter((d) => d.teamName === teamName)
        .map((d) => d.surname),
    }))
  const teamStandings = sortByCountback(teamStandingsRaw, (t) => t.teamName).map((t, i) => {
    const { finishes: _f, ...rest } = t
    return { position: i + 1, ...rest }
  })

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
    driverStandings: driverStandingsSorted,
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
    sprintPointsByRound,
    meetings,
    sessions,
  }
}

// The route that serves this is STATIC with ISR (revalidate: 60): the
// bundle is generated at build time and refreshed in the background — a
// user request NEVER runs this compute inline. On a revalidation failure
// we THROW so Next keeps serving the last good snapshot; at build time
// (openf1 may be locked or flaky) we never throw — a blocked placeholder
// ships and the first background revalidation replaces it.
// Build-time fallback: if the compute fails (openf1 429 bursts poison
// roughly every other build — measured 4/4 replays throwing on an idle
// Monday), bake the LIVE production site's current snapshot instead.
// Production always serves last-good data by design, even mid-lockout,
// so a deploy can never bake the blocked placeholder unless this is the
// project's first-ever deploy (no production URL to fall back to).
async function fetchProductionSnapshot(): Promise<SeasonBundle | null> {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (!host) return null
  try {
    const res = await fetch(`https://${host}/api/season-data`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as SeasonBundle | { blocked: true }
    if (!body || body.blocked || !Array.isArray((body as SeasonBundle).meetings)) return null
    console.error(
      '[season-data] build-time compute failed; baked the live production snapshot as fallback'
    )
    return body as SeasonBundle
  } catch {
    return null
  }
}

// Build-scope memo: /api/season-data, /drivers, and /teams all prerender
// from this snapshot. One compute (or one fallback fetch) serves every
// route in the build worker instead of three full openf1 sweeps — three
// sweeps back-to-back is exactly the 429 pattern that poisons builds.
let buildMemo: SeasonBundle | { blocked: true } | null = null

export async function buildSeasonSnapshot(): Promise<SeasonBundle | { blocked: true }> {
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
  if (isBuild && buildMemo) return buildMemo
  try {
    const bundle = await computeSeasonData()
    if (isBuild) buildMemo = bundle
    return bundle
  } catch (err) {
    if (isBuild) {
      const fromProd = await fetchProductionSnapshot()
      buildMemo = fromProd ?? { blocked: true }
      return buildMemo
    }
    throw err
  }
}
