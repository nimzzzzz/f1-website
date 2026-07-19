'use client'

import { useEffect, useState } from 'react'
import { fetchSeasonData, bundleAsOf } from '@/lib/season-data'
import type { BundleDriverStanding, BundleTeamStanding } from '@/lib/season-data'
import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'

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
  const [driverStandings, setDriverStandings] = useState<BundleDriverStanding[]>([])
  const [teamStandings, setTeamStandings] = useState<BundleTeamStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRaces, setCompletedRaces] = useState(0)
  const [seasonYear, setSeasonYear] = useState<number | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)

  // One server-computed bundle replaces the ~20-request client pipeline.
  useEffect(() => {
    let alive = true
    fetchSeasonData()
      .then((bundle) => {
        if (!alive) return
        if (!bundle) return // blocked with no cached bundle — banner covers it
        setDriverStandings(bundle.driverStandings)
        setTeamStandings(bundle.teamStandings)
        setCompletedRaces(bundle.completedRaces)
        setSeasonYear(bundle.seasonYear)
        setAsOf(bundleAsOf(bundle))
      })
      .catch(() => {
        if (alive) setError('Failed to load standings')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
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
            {asOf && <span className="ml-4">AS OF {asOf}</span>}
          </p>
        </FadeUp>

        {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

        {driverStandings.length === 0 ? (
          (
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
                          {d.surname}
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
                  const teamDrivers = t.driverSurnames
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
