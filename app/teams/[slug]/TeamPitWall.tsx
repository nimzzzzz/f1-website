'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Image from 'next/image'
import type { MachineDriver, MachineWeekend, TeamMachineView } from '@/lib/season-view'
import { latestTeamWeekend, weekendDriverPoints } from '@/lib/team-story'
import { resultLabel } from '@/lib/driver-story'
import { circuitImageForMeeting } from '@/lib/media-manifest'
import { circuitPhoto } from '@/lib/circuit-photos-manifest'
import { getLenis } from '@/lib/lenis-store'

const pad = (n: number) => String(n).padStart(2, '0')

export default function TeamPitWall({ weekends, drivers, seasonYear, season }: { weekends: MachineWeekend[]; drivers: MachineDriver[]; seasonYear: number | null; season: TeamMachineView['season'] }) {
  const [selectedKey, selectKey] = useState<number | null>(null)
  const weekend = weekends.find((w) => w.meetingKey === selectedKey) ?? latestTeamWeekend(weekends)
  const rail = useRef<HTMLDivElement>(null)
  const peak = Math.max(1, ...weekends.map((w) => weekendDriverPoints(w).total ?? 0))

  useEffect(() => {
    const node = rail.current
    const selected = node?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!node || !selected) return
    // Horizontal only: scrollIntoView here would also pull the visitor down
    // the document as soon as the page hydrates.
    node.scrollTo({ left: selected.offsetLeft - node.offsetLeft - node.clientWidth / 2 + selected.clientWidth / 2, behavior: 'instant' })
  }, [weekend?.meetingKey])

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % weekends.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + weekends.length) % weekends.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = weekends.length - 1
    else return
    event.preventDefault()
    selectKey(weekends[next].meetingKey)
    rail.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus({ preventScroll: true })
  }

  const totals = weekend ? weekendDriverPoints(weekend) : null
  const outline = weekend ? circuitImageForMeeting({ meeting_key: weekend.meetingKey, country_name: weekend.country }) : null
  const photo = weekend ? circuitPhoto(weekend.circuit) : null

  return <section id="team-pit-wall" className="team-pit-wall team-chapter" aria-labelledby="team-pit-heading">
    <div className="team-section-heading" data-team-reveal><span className="team-label">{seasonYear ?? 'CURRENT SEASON'} / DRIVER RESULTS</span><h2 id="team-pit-heading">The pit wall.</h2><p>Pick a weekend. See how each driver delivered.</p></div>
    {weekend && totals ? <>
      <div className="team-weekend-key"><span className="team-label">WEEKEND POINTS</span><div>{drivers.map((d, i) => <span key={d.number}><i style={{ backgroundColor: i === 0 ? 'var(--team-colour)' : i === 1 ? '#f5f5f3' : '#949494' }} />{d.acronym}</span>)}</div></div>
      <div ref={rail} className="team-weekend-rail" role="radiogroup" aria-label="Choose a race weekend">
        {weekends.map((round, i) => <button key={round.meetingKey} type="button" role="radio" aria-checked={round.meetingKey === weekend.meetingKey} aria-controls="team-weekend-detail" tabIndex={round.meetingKey === weekend.meetingKey ? 0 : -1} onKeyDown={(e) => onKey(e, i)} onClick={() => selectKey(round.meetingKey)} data-status={round.status}>
          <span className="sr-only">Round </span><span className="team-weekend-number">{pad(round.round)}</span>{' '}
          <span className="team-weekend-bars" aria-hidden="true">{round.results.map((r, j) => <i key={r.driverNumber} style={{ '--bar-height': `${round.status === 'cancelled' ? 0 : ((r.points + r.sprintPoints) / peak) * 100}%`, '--bar-colour': j === 0 ? 'var(--team-colour)' : j === 1 ? '#f5f5f3' : '#949494' } as CSSProperties} />)}{round.status === 'cancelled' && <span>×</span>}</span>
          <span className="team-weekend-code">{round.circuit.slice(0, 3).toUpperCase()}</span><span className="sr-only">, {round.circuit}, {round.status === 'complete' ? `${weekendDriverPoints(round).total} driver points` : round.status}</span>
        </button>)}
      </div>
      <p className="team-weekend-hint">Select a round above <span>← →</span></p>
      <div id="team-weekend-detail" className="team-weekend-detail" tabIndex={-1} aria-live="polite" aria-atomic="true">
        <div key={`venue-${weekend.meetingKey}`} className="team-weekend-venue">
          {photo && <div className="team-weekend-photo"><Image src={photo} alt="" fill quality={45} sizes="(min-width: 768px) 42vw, 100vw" /></div>}
          <div className="team-weekend-location"><span className="team-label">ROUND {pad(weekend.round)} / {new Date(weekend.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}</span><h3>{weekend.circuit}</h3><p>{weekend.country}</p></div>
          {outline && <div className="team-weekend-outline"><Image src={outline} alt="" fill sizes="180px" /></div>}
          <span className="team-weekend-state">{weekend.status === 'complete' ? 'CLASSIFICATION' : weekend.status === 'cancelled' ? 'CANCELLED' : 'UPCOMING GRAND PRIX'}</span>
        </div>
        <div key={`results-${weekend.meetingKey}`} className="team-weekend-results">
          <div className="team-result-column-labels team-label"><span>DRIVER</span><span>FINISH</span><span>GP PTS</span></div>
          {drivers.map((driver) => {
            const result = weekend.results.find((r) => r.driverNumber === driver.number)
            return <div key={driver.number} className="team-weekend-result" data-podium={result?.status === 'finished' && result.position !== null && result.position <= 3}>
              <div><span className="team-label">{driver.acronym}</span><span>{driver.surname}</span></div>
              <strong className={result?.status === 'finished' || result?.status === 'out' ? undefined : 'team-result-status'}>{result ? resultLabel(result) : 'NO ENTRY'}</strong>
              <span>{weekend.status === 'complete' && result ? result.points : '–'}</span>
            </div>
          })}
          <div className="team-weekend-total"><div><span className="team-label">DRIVER TOTAL</span><strong>{totals.total === null ? '–' : `+${totals.total}`}</strong></div><div><span>Grand Prix <b>{weekend.status === 'complete' ? totals.grandPrix : '–'}</b></span><span>Sprint <b>{totals.sprint > 0 ? `+${totals.sprint}` : '0'}</b></span></div></div>
          <p className="team-result-note">{weekend.status === 'cancelled' ? 'This round was cancelled.' : weekend.status === 'upcoming' ? totals.sprint > 0 ? 'Sprint points are in. Grand Prix results will follow.' : 'Results will appear after the race.' : `Combined weekend points for ${drivers.map((d) => d.acronym).join(' + ')}. Results follow the drivers shown.`}</p>
        </div>
      </div>
      <div className="team-pit-season">
        <dl><div><dt>BEST GP FINISH</dt><dd>{season.bestFinish === null ? '–' : `P${season.bestFinish}`}</dd></div><div><dt>GP PODIUMS</dt><dd>{season.podiums}</dd></div><div><dt>RETIREMENTS</dt><dd>{season.dnfs}</dd></div></dl>
        {season.biggestHaul && <button type="button" className="team-best-weekend" onClick={() => {
          const best = weekends.find((w) => w.round === season.biggestHaul?.round)
          if (!best) return
          selectKey(best.meetingKey)
          const panel = document.getElementById('team-weekend-detail')
          if (!panel) return
          panel.focus({ preventScroll: true })
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          const lenis = getLenis()
          if (lenis) lenis.scrollTo(panel, { offset: -84, immediate: reduced, duration: .8 })
          else panel.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
        }}><span className="team-label">BEST WEEKEND</span><span>+{season.biggestHaul.points} <span>{season.biggestHaul.circuit}</span></span><span aria-hidden="true">↗</span></button>}
      </div>
      <p className="team-result-note">Season record of the drivers shown.</p>
    </> : <p className="team-empty">The race calendar will appear when the season is available.</p>}
  </section>
}
