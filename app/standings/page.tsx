'use client'

import { useEffect, useState } from 'react'
import type { Session, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { CANCELLED_COUNTRIES, fetchAllSessionResults } from '@/lib/openf1'
import { getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

interface DriverStanding {
  driverNumber: number
  fullName: string
  teamName: string
  teamColour: string
  nameAcronym: string
  points: number
  wins: number
  podiums: number
}

interface TeamStanding {
  teamName: string
  teamColour: string
  points: number
  wins: number
}

const surname = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

// Divider between consecutive tower rows carrying the points gap — the
// hairline is data here, not decoration.
function GapDivider({ gap }: { gap: number }) {
  return (
    <div className="relative h-px bg-[var(--line)]">
      {gap > 0 && (
        <span className="label-mono absolute right-[8%] top-1/2 -translate-y-1/2 bg-[var(--bg)] px-2.5 text-[var(--text-dim)]">
          −{Math.floor(gap)}
        </span>
      )}
    </div>
  )
}

export default function StandingsPage() {
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([])
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRaces, setCompletedRaces] = useState(0)
  const [seasonYear, setSeasonYear] = useState<number | null>(null)
  const apiBlocked = useApiBlocked()

  useEffect(() => {
    async function compute() {
      try {
        const allSessions = await getCachedSessions()
        setSeasonYear(allSessions[0]?.year ?? null)
        const now = new Date()
        const notCancelled = (s: Session) => !CANCELLED_COUNTRIES.has(s.country_name)

        const completedRaceSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Race' &&
            new Date(s.date_end) < now &&
            notCancelled(s)
        )

        const completedSprintSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Sprint' &&
            new Date(s.date_end) < now &&
            notCancelled(s)
        )

        setCompletedRaces(completedRaceSessions.length)

        const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]

        const driverRefKey = completedRaceSessions.length > 0
          ? [...completedRaceSessions].sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0].session_key
          : allSessions.filter((s) => new Date(s.date_end) < now && notCancelled(s)).sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]?.session_key

        const [refDrivers, resultsMap] = await Promise.all([
          driverRefKey ? getCachedDrivers(driverRefKey) : Promise.resolve([] as Driver[]),
          fetchAllSessionResults(allPointsSessions.map((s) => s.session_key), getCachedSessionResult),
        ])

        const driverMap = new Map<number, DriverStanding>()
        const teamMap = new Map<string, TeamStanding>()

        for (const d of refDrivers) {
          if (!driverMap.has(d.driver_number)) {
            driverMap.set(d.driver_number, {
              driverNumber: d.driver_number,
              fullName: d.full_name,
              teamName: d.team_name,
              teamColour: d.team_colour,
              nameAcronym: d.name_acronym,
              points: 0,
              wins: 0,
              podiums: 0,
            })
          }
          if (!teamMap.has(d.team_name)) {
            teamMap.set(d.team_name, {
              teamName: d.team_name,
              teamColour: d.team_colour,
              points: 0,
              wins: 0,
            })
          }
        }

        for (const session of allPointsSessions) {
          const results = resultsMap.get(session.session_key)
          if (!results) continue
          for (const r of results) {
            const ds = driverMap.get(r.driver_number)
            if (ds) {
              ds.points += r.points ?? 0
              if (r.position === 1) ds.wins++
              if (r.position !== null && r.position <= 3) ds.podiums++

              const ts = teamMap.get(ds.teamName)
              if (ts) {
                ts.points += r.points ?? 0
                if (r.position === 1) ts.wins++
              }
            }
          }
        }

        const sortedDrivers = Array.from(driverMap.values())
          .sort((a, b) => b.points - a.points || b.wins - a.wins)

        const sortedTeams = Array.from(teamMap.values())
          .sort((a, b) => b.points - a.points || b.wins - a.wins)

        setDriverStandings(sortedDrivers)
        setTeamStandings(sortedTeams)
      } catch {
        setError('Failed to compute standings')
      } finally {
        setLoading(false)
      }
    }
    compute()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-44 animate-pulse rounded bg-white/5" />
        <div className="mt-8 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 w-[65%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
        <p className="label-mono mt-10 text-[var(--text-dim)]">COMPUTING STANDINGS…</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip">
      {/* massive dim outline header behind the tower */}
      <span
        aria-hidden
        className="outline-numeral absolute -right-[4vw] top-[1vh] z-0 leading-none"
        style={{ fontSize: 'clamp(7rem, 17vw, 21rem)', WebkitTextStroke: '1px rgba(245,245,243,0.07)' }}
      >
        STANDINGS
      </span>

      <div className="relative z-10 px-6 pb-28 pt-20 md:px-14">
        <FadeUp>
          <p className="label-mono text-[var(--text-dim)]">
            DRIVERS&rsquo; CHAMPIONSHIP{seasonYear !== null ? ` — ${seasonYear}` : ''} · AFTER{' '}
            {String(completedRaces).padStart(2, '0')} ROUND{completedRaces !== 1 ? 'S' : ''}
          </p>
        </FadeUp>

        {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

        {driverStandings.length === 0 ? (
          !apiBlocked && (
            <p className="label-mono mt-16 text-[var(--text-dim)]">
              NO STANDINGS YET — DATA ARRIVES AS THE SEASON RUNS
            </p>
          )
        ) : (
          <>
            {/* ─── The drivers tower ─── */}
            <div className="mt-10">
              {driverStandings.map((d, i) => (
                <div key={d.driverNumber}>
                  {i > 0 && (
                    <GapDivider gap={driverStandings[i - 1].points - d.points} />
                  )}
                  <ClipReveal>
                    <div className="flex items-baseline gap-5 py-3 md:gap-9">
                      <span
                        aria-label={`Position ${i + 1}`}
                        className={`w-[1.4em] shrink-0 text-right leading-[0.85] ${
                          i === 0 ? '' : 'outline-numeral'
                        }`}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(6rem, 12vw, 11rem)',
                          ...(i === 0 ? { color: 'var(--accent)' } : {}),
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate uppercase leading-[0.9] text-[var(--text)]"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(2.4rem, 6vw, 6rem)',
                          }}
                          title={d.fullName}
                        >
                          {surname(d.fullName)}
                        </p>
                        <p className="label-mono mt-2 flex items-center gap-2 text-[var(--text-dim)]">
                          <span
                            aria-hidden
                            className="inline-block h-[2px] w-3"
                            style={{ backgroundColor: `#${d.teamColour}` }}
                          />
                          {d.teamName.toUpperCase()}
                          {d.wins > 0 && <span>· {d.wins} WIN{d.wins > 1 ? 'S' : ''}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="font-mono tabular-nums text-[var(--text)]"
                          style={{ fontSize: 'clamp(1.3rem, 2.6vw, 2.2rem)' }}
                        >
                          <CountUp value={Math.floor(d.points)} />
                        </span>
                        <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
                      </div>
                    </div>
                  </ClipReveal>
                </div>
              ))}
            </div>

            {/* ─── The constructors tower ─── */}
            <div className="mt-28">
              <FadeUp>
                <p className="label-mono text-[var(--text-dim)]">
                  CONSTRUCTORS&rsquo; CHAMPIONSHIP
                </p>
              </FadeUp>
              <div className="mt-10">
                {teamStandings.map((t, i) => {
                  const teamDrivers = driverStandings
                    .filter((d) => d.teamName === t.teamName)
                    .map((d) => surname(d.fullName))
                  return (
                    <div key={t.teamName}>
                      {i > 0 && (
                        <GapDivider gap={teamStandings[i - 1].points - t.points} />
                      )}
                      <ClipReveal>
                        <div className="flex items-baseline gap-5 py-3 md:gap-9">
                          <span
                            aria-label={`Position ${i + 1}`}
                            className={`w-[1.4em] shrink-0 text-right leading-[0.85] ${
                              i === 0 ? '' : 'outline-numeral'
                            }`}
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: 'clamp(4.5rem, 9vw, 8rem)',
                              ...(i === 0 ? { color: 'var(--accent)' } : {}),
                            }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate uppercase leading-[0.9] text-[var(--text)]"
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 'clamp(2rem, 5vw, 4.6rem)',
                              }}
                            >
                              {t.teamName}
                            </p>
                            <p className="label-mono mt-2 flex items-center gap-2 text-[var(--text-dim)]">
                              <span
                                aria-hidden
                                className="inline-block h-[2px] w-3"
                                style={{ backgroundColor: `#${t.teamColour}` }}
                              />
                              {teamDrivers.join(' / ')}
                              {t.wins > 0 && <span>· {t.wins} WIN{t.wins > 1 ? 'S' : ''}</span>}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className="font-mono tabular-nums text-[var(--text)]"
                              style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.9rem)' }}
                            >
                              <CountUp value={Math.floor(t.points)} />
                            </span>
                            <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
                          </div>
                        </div>
                      </ClipReveal>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
