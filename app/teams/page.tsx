'use client'

import { useEffect, useState } from 'react'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import { fetchSeasonData, bundleAsOf, type SeasonBundle } from '@/lib/season-data'
import { teamToSlug } from '@/lib/team-data'
import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function TeamsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [bundle, setBundle] = useState<SeasonBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const apiBlocked = useApiBlocked()

  useEffect(() => {
    getCachedLatestDrivers()
      .then((all) => setDrivers(deduplicateDrivers(all)))
      .finally(() => setLoading(false))
  }, [])

  // Constructor standings come from the server bundle.
  useEffect(() => {
    let alive = true
    fetchSeasonData().then((b) => {
      if (alive && b) setBundle(b)
    })
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-10 space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 w-[70%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
        <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING CONSTRUCTORS…</p>
      </div>
    )
  }

  // Bundle order when standings exist; driver-data grouping otherwise.
  const teams = bundle?.teamStandings.length
    ? bundle.teamStandings.map((t) => ({
        name: t.teamName,
        colour: `#${t.teamColour || 'F5F5F3'}`,
        points: Math.floor(t.points) as number | null,
        position: t.position as number | null,
        wins: t.wins,
      }))
    : [...new Set(drivers.map((d) => d.team_name))].sort().map((name) => ({
        name,
        colour: `#${drivers.find((d) => d.team_name === name)?.team_colour || 'F5F5F3'}`,
        points: null,
        position: null,
        wins: 0,
      }))

  const asOf = bundle ? bundleAsOf(bundle) : null

  if (teams.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        {!apiBlocked && <p className="label-mono text-[var(--text-dim)]">NO CONSTRUCTOR DATA YET</p>}
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <FadeUp>
        <p className="label-mono flex flex-wrap gap-x-4 text-[var(--text-dim)]">
          CONSTRUCTORS&rsquo; CHAMPIONSHIP{bundle?.seasonYear ? ` — ${bundle.seasonYear}` : ''}
          {asOf && <span>AS OF {asOf}</span>}
          {apiBlocked && !bundle && (
            <span className="flex items-center gap-2 text-[var(--accent)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
              LIVE SESSION — DATA PAUSED
            </span>
          )}
        </p>
      </FadeUp>

      <div className="mt-12">
        {teams.map((team) => {
          const teamDrivers = drivers
            .filter((d) => d.team_name === team.name)
            .sort((a, b) => a.driver_number - b.driver_number)
          return (
            <ClipReveal key={team.name}>
              <TransitionLink
                href={`/teams/${teamToSlug(team.name)}`}
                className="group relative block overflow-hidden border-t border-[var(--line)] py-10 md:py-12"
              >
                {/* constructors position — outline numeral behind the band */}
                {team.position !== null && (
                  <span
                    aria-hidden
                    className="outline-numeral pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 leading-none"
                    style={{ fontSize: 'clamp(7rem, 15vw, 13rem)' }}
                  >
                    {pad2(team.position)}
                  </span>
                )}

                {/* the team's colour as a thin leading rule — their accent */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-[2px] w-16 md:w-24"
                  style={{ backgroundColor: team.colour }}
                />

                <div className="relative flex flex-wrap items-baseline gap-x-10 gap-y-4">
                  <h2
                    className="uppercase leading-[0.9] text-[var(--text)] transition-transform duration-300 group-hover:translate-x-3 motion-reduce:transition-none"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 6.5vw, 6rem)' }}
                  >
                    {team.name}
                  </h2>
                  {team.points !== null && (
                    <span className="shrink-0">
                      <span
                        className="font-mono tabular-nums text-[var(--text)]"
                        style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)' }}
                      >
                        <CountUp value={team.points} />
                      </span>
                      <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
                    </span>
                  )}
                </div>

                <div className="label-mono relative mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[var(--text-dim)]">
                  {teamDrivers.map((d) => (
                    <span key={d.driver_number}>
                      {d.last_name?.toUpperCase()} <span className="opacity-60">#{d.driver_number}</span>
                    </span>
                  ))}
                  {team.wins > 0 && <span>· {team.wins} WIN{team.wins > 1 ? 'S' : ''}</span>}
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                    TEAM →
                  </span>
                </div>
              </TransitionLink>
            </ClipReveal>
          )
        })}
      </div>
    </div>
  )
}
