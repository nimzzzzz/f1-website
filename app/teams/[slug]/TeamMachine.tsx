'use client'

import { useMemo, useRef, type CSSProperties } from 'react'
import Image from 'next/image'
import { carImage, driverImage, teamLogoImage } from '@/lib/media-manifest'
import { toTeamMachine, type TeamMachineView } from '@/lib/season-view'
import type { TeamFacts } from '@/lib/team-facts'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import TeamCar from './TeamCar'
import TeamPitWall from './TeamPitWall'
import { useTeamMotion } from './useTeamMotion'
import './team-machine.css'

const pad = (value: number) => String(value).padStart(2, '0')

// The constructor has its own visual language: a launch stage, a paired
// garage, a selectable pit wall and a championship archive. All animation
// is local to this route; the scrolling /teams gallery is independent.
export default function TeamMachine({ view: initial, facts }: { view: TeamMachineView; facts: TeamFacts | null }) {
  const live = useLiveSnapshot(initial.computedAt)
  const view = useMemo(() => live ? toTeamMachine(live, initial.slug) ?? initial : initial, [live, initial])
  const root = useRef<HTMLDivElement>(null)
  useTeamMotion(root, view.slug)
  const logo = teamLogoImage(view.slug)
  const pair = view.drivers.slice(0, 2)
  const nextCar = view.nextTeam ? carImage(view.nextTeam.slug) : null
  const hasTitles = Boolean(facts?.titles.length)

  return (
    <div ref={root} className="team-machine" style={{ '--team-colour': view.colour, '--team-name-size': view.name.length > 10 ? '11.4vw' : '18vw' } as CSSProperties}>
      <section className="team-launch" aria-labelledby="team-name">
        <div className="team-launch-top">
          <TransitionLink href="/teams" className="team-back">← ALL TEAMS</TransitionLink>
          <span className="team-label">{view.seasonYear ?? 'CURRENT SEASON'} CONSTRUCTOR</span>
        </div>
        <div className="team-launch-identity">
          <h1 id="team-name">{view.name}</h1>
          {logo && <div className="team-launch-logo" data-monochrome={view.slug === 'haas-f1-team'}><Image src={logo} alt="" fill sizes="110px" unoptimized={logo.endsWith('.svg')} /></div>}
        </div>
        <TeamCar key={view.slug} slug={view.slug} name={view.name} />
        <dl className="team-launch-stats">
          <div><dt>CHAMPIONSHIP</dt><dd><span>P</span>{pad(view.position)}</dd></div>
          <div><dt>SEASON POINTS</dt><dd>{view.season.points}</dd></div>
          <div><dt>RACE WINS</dt><dd>{pad(view.season.wins)}</dd></div>
          <div className="team-launch-base"><dt>HOME OF THE TEAM</dt><dd>{facts?.base ?? view.name}</dd></div>
        </dl>
      </section>

      <section id="team-drivers" className="team-pairing team-chapter" aria-labelledby="team-pair-heading">
        <div className="team-section-heading" data-team-reveal>
          <h2 id="team-pair-heading">Two seats.<br /><span>One team.</span></h2>
        </div>
        {pair.length > 0 ? <>
          <div className="team-driver-bays">
            {pair.map((driver, i) => (
              <TransitionLink key={driver.number} href={`/drivers/${driver.acronym.toLowerCase()}`} className="team-driver-bay">
                <div className="team-driver-bay-top"><span className="team-label">CAR {pad(driver.number)}</span><span className="team-label">P{driver.position} IN THE CHAMPIONSHIP</span></div>
                <span className="team-driver-ghost" aria-hidden="true">{driver.acronym}</span>
                {driverImage(driver.acronym) && <div className="team-driver-portrait" data-team-portrait><Image src={driverImage(driver.acronym)!} alt="" fill sizes="(min-width: 768px) 34vw, 85vw" /></div>}
                <div className="team-driver-identity"><p>{driver.firstName}</p><h3>{driver.surname}</h3><span className="team-driver-link">DRIVER PROFILE <span aria-hidden="true">↗</span></span></div>
                <div className="team-driver-points"><span>{driver.points}</span><span className="team-label">SEASON PTS</span><i aria-hidden="true" data-second={i === 1} /></div>
              </TransitionLink>
            ))}
          </div>
          {view.pairing && pair.length === 2 && <div className="team-head-to-head" data-team-reveal>
            <div><span className="team-label">RACE HEAD-TO-HEAD</span><p>When both cars finish.</p></div>
            <div className="team-head-score"><span className="team-label">{pair[0].acronym}</span><strong>{view.pairing.winsA}</strong><span className="team-head-divider" aria-hidden="true">/</span><strong>{view.pairing.winsB}</strong><span className="team-label">{pair[1].acronym}</span></div>
            <p className="team-head-note">Across {view.pairing.bothClassified} races<br /> with both drivers classified.</p>
          </div>}
          {view.drivers.length > 2 && <div className="team-additional-drivers"><p className="team-label">ALSO IN THE STANDINGS</p>{view.drivers.slice(2).map((d) => <TransitionLink key={d.number} href={`/drivers/${d.acronym.toLowerCase()}`}>{d.firstName} {d.surname}<span>{d.points} PTS ↗</span></TransitionLink>)}</div>}
        </> : <p className="team-empty">The driver line-up will appear when the season data is available.</p>}
      </section>

      <TeamPitWall key={view.slug} weekends={view.weekends} drivers={view.drivers} seasonYear={view.seasonYear} season={view.season} />

      <section id="team-history" className="team-history team-chapter" aria-labelledby="team-history-heading">
        <div className="team-history-intro" data-team-reveal>
          <div><span className="team-label">THE CONSTRUCTOR ARCHIVE</span><h2 id="team-history-heading">{hasTitles ? 'A place in history.' : 'The story so far.'}</h2></div>
          {facts && <div className="team-founded"><span className="team-label">ESTABLISHED</span><strong>{facts.founded}</strong></div>}
        </div>
        {facts ? <>
          {hasTitles ? <div className="team-title-wall">
            <div className="team-title-count"><strong>{pad(facts.titles.length)}</strong><span>CONSTRUCTORS’<br />WORLD CHAMPIONSHIPS</span></div>
            <ol className="team-title-years" aria-label="Constructors’ championship winning years">{facts.titles.map((year) => <li key={year} className="team-title-plaque" data-team-title><span aria-hidden="true">WORLD<br />CHAMPIONS</span><strong>{year}</strong></li>)}</ol>
            <p className="team-archive-note">Titles won under the {view.name} name.</p>
          </div> : <div className="team-first-title"><span className="team-label">CONSTRUCTORS’ CHAMPIONSHIPS</span><p>The first title is the target.</p><span>No titles under the {view.name} name.</span></div>}
          <div className="team-history-details">
            <div className="team-lineage"><h3>{facts.lineage.length > 1 ? 'The road to ' + view.name : 'On the grid'}</h3><p className="team-label">{facts.lineage.length > 1 ? 'F1 ROOTS' : 'FIRST F1 SEASON'} / {facts.firstSeason}</p>
              {facts.lineage.length > 1 ? <ol>{facts.lineage.map((name, i) => <li key={`${name}-${i}`} data-current={i === facts.lineage.length - 1}>{name}{i < facts.lineage.length - 1 && <span aria-hidden="true">→</span>}</li>)}</ol> : <p className="team-lineage-name">{view.name}</p>}
            </div>
            <dl className="team-factory-facts"><div><dt>TEAM PRINCIPAL</dt><dd>{facts.principal}</dd></div><div><dt>POWER UNIT</dt><dd>{facts.engine}</dd></div><div><dt>BASE</dt><dd>{facts.base}</dd></div></dl>
          </div>
        </> : <p className="team-empty">The constructor archive is being assembled.</p>}
      </section>

      {view.nextTeam && <TransitionLink href={`/teams/${view.nextTeam.slug}`} className="team-next" style={{ '--next-colour': view.nextTeam.colour } as CSSProperties}>
        <span className="team-label">NEXT GARAGE</span><span className="team-next-name">{view.nextTeam.name}<span aria-hidden="true">↗</span></span>
        {nextCar && <div className="team-next-car"><Image src={nextCar} alt="" fill sizes="(min-width: 768px) 60vw, 90vw" /></div>}
      </TransitionLink>}
    </div>
  )
}
