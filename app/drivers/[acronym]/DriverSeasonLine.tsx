'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CAREER_STATS, DRIVER_NATIONALITIES } from '@/lib/driver-data'
import { driverImage, carImage } from '@/lib/media-manifest'
import { circuitPhoto } from '@/lib/circuit-photos-manifest'
import { teamToSlug } from '@/lib/team-data'
import { toDriverSeason, type DriverSeasonView } from '@/lib/season-view'
import { featuredSeasonStation, latestEnteredStation } from '@/lib/driver-story'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import { getLenis } from '@/lib/lenis-store'
import TreatedImage from '@/components/media/TreatedImage'
import { DriverPageTransition, DriverSharedElement } from '../DriverTransition'
import SeasonJourney from './SeasonJourney'
import DriverDuel from './DriverDuel'
import '../drivers.css'

export default function DriverSeasonLine({ view: initialView }: { view: DriverSeasonView }) {
  const live = useLiveSnapshot(initialView.computedAt)
  const view = useMemo(() => live ? toDriverSeason(live, initialView.driver.acronym) ?? initialView : initialView, [live, initialView])
  const d = view.driver
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const selected = view.stations.find((s) => s.meetingKey === selectedKey) ?? latestEnteredStation(view.stations)
  const featured = featuredSeasonStation(view.stations)
  const photo = driverImage(d.acronym)
  const venuePhoto = featured ? circuitPhoto(featured.circuit) : null
  const teamSlug = teamToSlug(d.teamName)
  const career = CAREER_STATS[d.acronym]
  const root = useRef<HTMLDivElement>(null)
  const goToSection = (target: HTMLElement) => {
    target.focus({ preventScroll: true })
    const lenis = getLenis()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (lenis) lenis.scrollTo(target, { offset: -84, immediate: reduced, duration: 1.1 })
    else target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
  }
  const selectFeatured = () => {
    if (!featured) return
    setSelectedKey(featured.meetingKey)
    const target = document.getElementById(`season-race-${featured.meetingKey}`)
    if (!target) return
    goToSection(target)
  }
  const compareRound = (meetingKey: number) => {
    setSelectedKey(meetingKey)
    const target = document.getElementById('driver-comparison')
    if (target) goToSection(target)
  }

  useEffect(() => {
    // Only decorative marks animate on arrival. Text, statistics and the
    // entire season remain visible with JS disabled or motion reduced.
    const elements = root.current?.querySelectorAll<HTMLElement>('.driver-moment, .driver-machine')
    if (!elements || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.arrived = 'true'; observer.unobserve(entry.target) }
      })
    }, { threshold: 0.15 })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return (
    <DriverPageTransition>
      <div ref={root} className="driver-profile" style={{ '--driver-colour': `#${d.teamColour || 'F5F5F3'}`, '--surname-size': d.surname.length > 9 ? '14vw' : '18vw' } as CSSProperties}>
        <section className="driver-profile-hero" aria-labelledby="driver-name">
          <div className="driver-profile-topline">
            <Link className="driver-back" href={`/drivers?driver=${d.acronym.toLowerCase()}`} transitionTypes={['driver-back']}>← THE GRID</Link>
            <span className="driver-eyebrow">{view.seasonYear ?? 'CURRENT'} / DRIVER PROFILE</span>
          </div>
          <div className="driver-profile-identity">
            <p className="driver-eyebrow"><span className="driver-team-dash" />{d.teamName}</p>
            <p className="driver-profile-nationality">{DRIVER_NATIONALITIES[d.acronym] ?? d.countryCode}</p>
            <p className="driver-profile-position"><span>P{String(d.position).padStart(2, '0')}</span> IN THE CHAMPIONSHIP</p>
          </div>
          <div className="driver-hero-ruling" aria-hidden="true"><span /><span /><span /></div>
          <DriverSharedElement acronym={d.acronym} part="number">
            <span className="driver-profile-number" aria-hidden="true">{d.number}</span>
          </DriverSharedElement>
          {photo && <DriverSharedElement acronym={d.acronym} part="portrait">
            <div className="driver-profile-portrait" aria-hidden="true">
              <Image src={photo} alt="" fill quality={60} loading="eager" fetchPriority="high" sizes="(min-width: 768px) 43vw, 85vw" className="driver-hero-image" />
            </div>
          </DriverSharedElement>}
          <h1 id="driver-name" className="driver-profile-name"><span>{d.firstName}</span>{d.surname}</h1>
          <dl className="driver-hero-stats">
            <div><dt>SEASON POINTS</dt><dd>{d.points}</dd></div>
            <div><dt>WINS</dt><dd>{String(d.wins).padStart(2, '0')}</dd></div>
            <div><dt>PODIUMS</dt><dd>{String(d.podiums).padStart(2, '0')}</dd></div>
            <div><dt>BEST FINISH</dt><dd>{view.bestFinish === null ? '—' : `P${view.bestFinish}`}</dd></div>
          </dl>
        </section>

        <div className="driver-profile-content">
          <SeasonJourney view={view} selected={selected} onCompare={compareRound} />
          <DriverDuel view={view} selected={selected} onSelect={setSelectedKey} />
        </div>

        {featured && <section className="driver-moment" aria-labelledby="driver-moment-heading">
          {venuePhoto && <Image src={venuePhoto} alt={`${featured.circuit} circuit`} fill sizes="100vw" className="driver-moment-photo" />}
          <div className="driver-moment-shade" aria-hidden="true" />
          <div className="driver-moment-copy">
            <p className="driver-eyebrow">03 / THE HIGH POINT</p>
            <h2 id="driver-moment-heading">{featured.position === 1 ? 'FIRST WIN.' : featured.position! <= 3 ? 'BEST PODIUM.' : 'BEST FINISH.'}<br /><span>{featured.circuit.toUpperCase()}.</span></h2>
            <p className="driver-moment-caption">{featured.position === 1 ? `The first victory of ${view.seasonYear ?? 'the season'}.` : `The season’s best classified Grand Prix result.`} Round {String(featured.round).padStart(2, '0')} · {featured.country}</p>
            <button type="button" className="driver-text-link" onClick={selectFeatured}>EXPLORE THIS RESULT <span>↗</span></button>
          </div>
          <div className="driver-moment-result" aria-label={`Position ${featured.position}, ${featured.points} Grand Prix points`}><span>P{featured.position}</span><p>{featured.points} GP POINTS</p></div>
        </section>}

        <section className="driver-machine driver-profile-content" aria-labelledby="driver-machine-heading">
          <div className="driver-section-heading">
            <div><p className="driver-eyebrow">{featured ? '04' : '03'} / THE MACHINE</p><h2 id="driver-machine-heading">{d.teamName}</h2></div>
            <Link href={`/teams/${teamSlug}`} className="driver-text-link">INSIDE THE TEAM <span>↗</span></Link>
          </div>
          <div className="driver-machine-photo"><TreatedImage src={carImage(teamSlug)} treatment="team" aspect="21/7" sizes="90vw" fade={false} /></div>
          <div className="driver-season-footnote"><span>{view.stations.filter((s) => s.status === 'finished' || s.status === 'out').length} GP ENTRIES</span><span>{view.dnfs} DNFS</span><span>CAR {d.number}</span></div>
          {career && <details className="driver-career">
            <summary>CAREER RECORD <span>+</span></summary>
            <p className="driver-data-note">Archived career totals. This season’s results are shown above.</p>
            <dl>{([
              ['GRANDS PRIX', career.grandsPrix], ['WORLD TITLES', career.championships], ['WINS', career.wins],
              ['PODIUMS', career.podiums], ['POLES', career.poles], ['POINTS', career.points],
            ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </details>}
          <Link className="driver-back driver-footer-back" href={`/drivers?driver=${d.acronym.toLowerCase()}`} transitionTypes={['driver-back']}>← BACK TO THE GRID</Link>
        </section>
      </div>
    </DriverPageTransition>
  )
}
