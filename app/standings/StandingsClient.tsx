'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { unavailableMessage } from '@/lib/fetch-result'
import { useFreshSeasonBundle } from '@/lib/use-season-bundle'
import type { SeasonBundle } from '@/lib/season-data'
import { carImage, driverImage } from '@/lib/media-manifest'
import { canonicalDriverSlug, canonicalTeamSlug } from '@/lib/known-slugs'
import { teamToSlug } from '@/lib/team-data'
import { getLenis } from '@/lib/lenis-store'
import StandingRow from './StandingRow'
import { useStandingsMotion } from './useStandingsMotion'
import './standings.css'

function jumpToChampionship(event: MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = document.getElementById(event.currentTarget.hash.slice(1))
  if (!target) return
  event.preventDefault()
  window.history.replaceState(window.history.state, '', event.currentTarget.hash)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = getLenis()
  if (lenis && !reduce) {
    lenis.scrollTo(target, { offset: -100, duration: 1.1, onComplete: () => target.focus({ preventScroll: true }) })
  } else {
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
}

function TowerColumns({ kind }: { kind: 'driver' | 'team' }) {
  return (
    <div role="row" className="standings-columns">
      <span role="columnheader">Pos<span className="sr-only">ition</span></span>
      <span role="columnheader">{kind === 'driver' ? 'Driver' : 'Constructor'}</span>
      <span role="columnheader">Points <span className="sr-only">and gap to position above</span></span>
    </div>
  )
}

export default function StandingsClient({ initialBundle }: { initialBundle: SeasonBundle | null }) {
  const [snapshot, setSnapshot] = useState(initialBundle)
  const [loading, setLoading] = useState(() => !initialBundle)
  const root = useRef<HTMLDivElement>(null)
  const { bundle, unavailable } = useFreshSeasonBundle(initialBundle?.computedAt ?? null)

  useEffect(() => { if (bundle) setSnapshot(bundle) }, [bundle])

  // Preserve the server snapshot during revalidation; failures end the
  // cold skeleton too. An outage is not an empty championship.
  useEffect(() => {
    if (bundle || initialBundle || unavailable) setLoading(false)
    const timer = setTimeout(() => setLoading(false), 8000)
    return () => clearTimeout(timer)
  }, [bundle, initialBundle, unavailable])

  const drivers = snapshot?.driverStandings ?? []
  const teams = snapshot?.teamStandings ?? []
  const completed = snapshot?.completedRaces ?? 0
  const year = snapshot?.seasonYear
  const towerKey = `${drivers.map((d) => d.driverNumber).join(',')}/${teams.map((t) => t.teamName).join(',')}`
  useStandingsMotion(root, loading ? '' : towerKey)

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-44 animate-pulse rounded bg-white/5" />
        <div className="mt-8 space-y-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 w-[65%] animate-pulse rounded bg-white/5" />)}
        </div>
        <h1 data-loading-h1 className="sr-only">DRIVERS&rsquo; CHAMPIONSHIP</h1>
        <p className="label-mono mt-10 text-[var(--text-dim)]">COMPUTING STANDINGS…</p>
      </div>
    )
  }

  return (
    <div className="standings-page" ref={root}>
      <span aria-hidden="true" className="standings-watermark">STANDINGS</span>
      <div className="standings-content">
        <header className="standings-heading" id="drivers-championship" tabIndex={-1}>
          <div>
            <h1 className="strip-header">DRIVERS&rsquo; CHAMPIONSHIP{year ? ` / ${year}` : ''}</h1>
            <p className="standings-rounds">After {String(completed).padStart(2, '0')} round{completed === 1 ? '' : 's'}</p>
          </div>
          {teams.length > 0 && <a href="#constructors-championship" className="standings-jump" onClick={jumpToChampionship}>Jump to constructors <span className="standings-arrow-down" aria-hidden="true">↗</span></a>}
        </header>
        {drivers.length === 0 && (unavailable ? (
          <p className="label-mono mt-16 border-l-2 border-[var(--accent)] pl-4 text-[var(--accent-text)]" role="status">{unavailableMessage(undefined, false, 'CHAMPIONSHIP')}</p>
        ) : <p className="label-mono mt-16 text-[var(--text-dim)]">NO STANDINGS YET. DATA ARRIVES AS THE SEASON RUNS.</p>)}
        {drivers.length > 0 && <>
          <p className="standings-legend" id="drivers-points-key">Bars compare points with P1. Gaps are to the position above.</p>
          <div className="standings-tower" role="table" aria-label="Drivers' championship standings" aria-describedby="drivers-points-key">
            <TowerColumns kind="driver" />
            {drivers.map((d, i) => {
              const slug = canonicalDriverSlug(d.nameAcronym)
              return <StandingRow key={d.driverNumber} kind="driver" position={i + 1} name={d.surname} fullName={d.fullName}
                detail={d.teamName} identifier={d.nameAcronym} colour={d.teamColour} points={d.points} leaderPoints={drivers[0].points}
                gap={i > 0 ? drivers[i - 1].points - d.points : null} wins={d.wins} image={driverImage(d.nameAcronym)} href={slug ? `/drivers/${slug}` : null} />
            })}
          </div>
        </>}
        {teams.length > 0 && <section className="standings-constructors" aria-labelledby="constructors-championship">
          <div className="standings-constructor-heading">
            <div>
              <p className="standings-rounds">The team battle{year ? ` / ${year}` : ''}</p>
              <h2 id="constructors-championship" tabIndex={-1}>CONSTRUCTORS&rsquo; <span>CHAMPIONSHIP</span></h2>
            </div>
            <a href="#drivers-championship" className="standings-jump" onClick={jumpToChampionship}>Back to drivers <span className="standings-arrow-up" aria-hidden="true">↗</span></a>
          </div>
          <p className="standings-legend" id="teams-points-key">Bars compare points with P1. Gaps are to the position above.</p>
          <div className="standings-tower standings-tower--teams" role="table" aria-label="Constructors' championship standings" aria-describedby="teams-points-key">
            <TowerColumns kind="team" />
            {teams.map((t, i) => {
              const slug = canonicalTeamSlug(teamToSlug(t.teamName))
              return <StandingRow key={t.teamName} kind="team" position={i + 1} name={t.teamName} fullName={t.teamName}
                detail={t.driverSurnames.join(' / ')} identifier="" colour={t.teamColour} points={t.points} leaderPoints={teams[0].points}
                gap={i > 0 ? teams[i - 1].points - t.points : null} wins={t.wins} image={carImage(teamToSlug(t.teamName))} href={slug ? `/teams/${slug}` : null} />
            })}
          </div>
        </section>}
      </div>
    </div>
  )
}
