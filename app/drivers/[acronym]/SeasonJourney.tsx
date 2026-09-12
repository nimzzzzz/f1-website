'use client'

import { useId, type CSSProperties } from 'react'
import Image from 'next/image'
import { circuitImageForMeeting } from '@/lib/media-manifest'
import { resultLabel, seasonFieldSize } from '@/lib/driver-story'
import { seasonLineX } from '@/lib/season-line-geometry'
import type { DriverSeasonView, SeasonStation } from '@/lib/season-view'
import { useSeasonJourney } from './useSeasonJourney'
import './season-journey.css'

const pad = (n: number) => String(n).padStart(2, '0')
const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function SeasonJourney({ view, selected, onCompare }: {
  view: DriverSeasonView
  selected: SeasonStation | null
  onCompare: (meetingKey: number) => void
}) {
  const { stations } = view
  const fieldRef = useSeasonJourney(stations)
  const clipId = `season-line-${useId().replace(/:/g, '')}`
  const fieldSize = seasonFieldSize(stations)
  const entries = stations.filter((station) => station.status === 'finished' || station.status === 'out')
  return (
    <section className="driver-season season-journey" aria-labelledby="driver-season-heading" id="season">
      <div className="driver-section-heading">
        <div><p className="driver-eyebrow">01 / RACE BY RACE</p><h2 id="driver-season-heading">THE SEASON<br /><span>LINE.</span></h2></div>
        <p className="driver-section-note">{pad(entries.length)} Grand Prix entries.<br />Every finish leaves its mark.</p>
      </div>
      <div className="season-journey-key">
        <span>FINISH POSITION <b>P1 → P{fieldSize}</b></span>
        <span>BREAK IN THE LINE = NOT CLASSIFIED</span>
      </div>
      {entries.length === 0 && <p className="driver-empty">The line begins with the first published Grand Prix result.</p>}
      <div ref={fieldRef} className="season-journey-field">
        <svg className="season-journey-path" aria-hidden="true">
          <defs><clipPath id={clipId}><rect data-line-clip x="0" y="0" width="100%" height="100%" /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <path data-line-path className="season-journey-bloom" />
            <path data-line-path className="season-journey-halo" />
            <path data-line-path data-line-core className="season-journey-core" />
          </g>
          <g data-line-marker style={{ opacity: 0 }}><circle r="13" fill="var(--driver-colour)" opacity=".25" /><circle r="4.5" fill="#fff" /></g>
        </svg>
        {stations.map((station) => {
          const entered = station.status === 'finished' || station.status === 'out'
          if (!entered) return <div key={station.meetingKey} className="season-journey-pending" data-status={station.status}>
            <span>{pad(station.round)}</span><h3>{station.circuit}</h3>
            <p>{station.status === 'upcoming' ? <><time dateTime={station.date}>{date(station.date)}</time><span>UPCOMING</span></> : resultLabel(station)}</p>
          </div>
          const out = station.status === 'out'
          const x = seasonLineX(station.position, fieldSize, false, out)
          const xm = seasonLineX(station.position, fieldSize, true, out)
          const art = circuitImageForMeeting({ meeting_key: station.meetingKey, country_name: station.country })
          const podium = !out && station.position !== null && station.position <= 3
          const best = !out && station.position === view.bestFinish
          const comparison = view.duel?.rounds.some((round) => round.meetingKey === station.meetingKey)
          return <article key={station.meetingKey} id={`season-race-${station.meetingKey}`} tabIndex={-1}
            className="season-journey-station" data-entered data-status={station.status} data-side={x > 50 ? 'left' : 'right'}
            data-x={x} data-xm={xm} data-podium={podium || undefined} data-selected={station.meetingKey === selected?.meetingKey || undefined}
            style={{ '--race-x': `${x}%`, '--race-xm': `${xm}%` } as CSSProperties}>
            <span className="season-journey-dot" data-race-dot aria-hidden="true" />
            <div className="season-journey-copy-position">
              <div data-race-copy className="season-journey-copy">
                {art && <Image src={art} alt="" width={210} height={150} sizes="210px" className="season-journey-circuit" />}
                <p className="season-journey-meta">ROUND {pad(station.round)}<span> / </span><time dateTime={station.date}>{date(station.date)}</time></p>
                <h3>{station.circuit}</h3>
                <div className="season-journey-finish"><strong>{resultLabel(station)}</strong>
                  {!out && <span>{station.position === 1 ? 'RACE WIN' : best ? 'SEASON BEST' : podium ? 'PODIUM' : 'RACE FINISH'}</span>}
                </div>
                <p className="season-journey-points"><span><span className="sr-only">{station.points}</span><span aria-hidden="true" data-race-points={station.points}>{station.points}</span> GP PTS</span>{station.sprintPoints > 0 && <span>+ {station.sprintPoints} SPRINT PTS</span>}</p>
                {comparison && <button type="button" className="season-journey-compare" onClick={() => onCompare(station.meetingKey)}>COMPARE ROUND <span>↗</span><span className="sr-only">. {station.circuit}, round {station.round}</span></button>}
              </div>
            </div>
          </article>
        })}
      </div>
    </section>
  )
}
