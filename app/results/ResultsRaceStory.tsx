'use client'

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { gridChanges, closestFinish, teamColor, teamPointsLeaders, type ResultRow } from '@/lib/results-story'
import type { RaceExtras } from '@/lib/results-data'
import { DriverPortrait } from './ResultsPodium'
import RaceTrace from './RaceTrace'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export default function ResultsRaceStory({ rows, extras, pending, onRetry }: {
  rows: ResultRow[]; extras: RaceExtras | null; pending: boolean; onRetry: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const changes = useMemo(() => gridChanges(rows, extras?.grid ?? []), [rows, extras])
  const biggestGain = [...changes].sort((a, b) => b.gain - a.gain)[0]
  const closest = closestFinish(rows)
  const [selected, setSelected] = useState<number | null>(null)
  const [replay, setReplay] = useState(0)
  const active = rows.find((r) => r.driver_number === selected) ?? biggestGain ?? rows[0]
  const activeChange = changes.find((r) => r.driver_number === active?.driver_number)
  const hasGrid = changes.length > 1
  const hasTrace = !!extras?.positions?.some((p) => p.driver_number === active?.driver_number)
  const leadingTeam = teamPointsLeaders(rows)

  useGSAP(() => {
    if (!hasGrid) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.results-race-path', { strokeDashoffset: 1 }, {
        strokeDashoffset: 0, duration: 1.4, stagger: .025, ease: 'power2.inOut',
        scrollTrigger: { trigger: ref.current, start: 'top 72%', once: true },
      })
    })
    return () => mm.revert()
  }, { scope: ref, dependencies: [hasGrid, replay], revertOnUpdate: true })

  if (!active) return null
  const max = Math.max(20, ...changes.flatMap((r) => [r.start, r.finish]))
  const height = Math.max(460, max * 23 + 42)
  const y = (position: number) => 35 + (position - 1) * 23
  const path = (start: number, finish: number) => `M 93 ${y(start)} C 290 ${y(start)}, 424 ${y(finish)}, 620 ${y(finish)}`

  return (
    <>
      {(biggestGain?.gain > 0 || closest || leadingTeam) && <aside className="results-race-highlights" aria-label="Race highlights">
        {biggestGain?.gain > 0 && <div><span className="results-caption">BIGGEST CLIMB</span><p><strong>+{biggestGain.gain}</strong><span>{biggestGain.driver.last_name}<small>positions gained</small></span></p></div>}
        {closest && <div><span className="results-caption">CLOSEST FINISH</span><p><strong>{closest.seconds.toFixed(3)}<em>s</em></strong><span>{closest.first.driver.name_acronym || closest.first.driver_number} / {closest.second.driver.name_acronym || closest.second.driver_number}<small>at the flag</small></span></p></div>}
        {leadingTeam && <div><span className="results-caption">MOST TEAM POINTS</span><p><strong>{leadingTeam.points}</strong><span>{leadingTeam.names.join(' / ')}<small>{leadingTeam.names.length > 1 ? 'points each this session' : 'points this session'}</small></span></p></div>}
      </aside>}
      <section ref={ref} className="results-race-story" aria-labelledby="results-race-story-heading" style={{ '--driver-color': teamColor(active.driver) } as CSSProperties}>
        <div className="results-story-intro">
          <h2 id="results-race-story-heading">{hasGrid ? <>FROM GRID<br />TO FLAG.</> : <>THE RACE<br />IN MOTION.</>}</h2>
          <p className="results-note">{hasGrid ? 'Where they started. Where they finished. Follow a driver through the field.' : 'Follow a driver’s recorded position through the race.'}</p>
          <label className="results-caption" htmlFor="results-story-driver">FOLLOW A DRIVER</label>
          <select id="results-story-driver" value={active.driver_number} onChange={(e) => setSelected(Number(e.target.value))}>
            {rows.map((r) => <option key={r.driver_number} value={r.driver_number}>{r.driver.full_name}</option>)}
          </select>
          <div className="results-story-driver">
            <div className="results-story-portrait"><DriverPortrait row={active} hero /></div>
            <div className="results-story-score">
              {activeChange ? <><strong>{activeChange.gain > 0 ? '+' : ''}{activeChange.gain}</strong><span>{activeChange.gain === 0 ? 'POSITION HELD' : activeChange.gain > 0 ? 'PLACES GAINED' : 'PLACES LOST'}</span><p>P{activeChange.start} <span aria-hidden>→</span> P{activeChange.finish}</p></> : <><strong>{active.detail?.dnf ? 'DNF' : active.detail?.dsq ? 'DSQ' : active.detail?.dns ? 'DNS' : active.position ? `P${active.position}` : 'NC'}</strong><span>{active.detail ? 'CLASSIFICATION' : 'LATEST POSITION'}</span></>}
            </div>
          </div>
          {hasGrid && <button type="button" className="results-replay" onClick={() => setReplay((n) => n + 1)}>REPLAY THE FINISH <span aria-hidden>↗</span></button>}
        </div>
        <div className="results-story-visual">
          {pending && !extras ? <p className="results-note" role="status">Loading the race story…</p> : hasGrid ? <>
            <div className="results-chart-labels"><span>STARTING GRID</span><span>CLASSIFIED FINISH</span></div>
            <svg className="results-grid-chart" viewBox={`0 0 730 ${height}`} aria-hidden="true">
              {[1, 5, 10, 15, 20].filter((p) => p <= max).map((p) => <line key={p} x1="93" x2="620" y1={y(p)} y2={y(p)} className="results-chart-rule" />)}
              {changes.map((r) => <g key={r.driver_number} className={r.driver_number === active.driver_number ? 'is-active' : ''} onMouseEnter={() => setSelected(r.driver_number)} onClick={() => setSelected(r.driver_number)}>
                <path d={path(r.start, r.finish)} className="results-race-path" pathLength="1" stroke={r.driver_number === active.driver_number ? teamColor(r.driver) : '#666666'} fill="none" />
                <text x="1" y={y(r.start) + 4} className="results-grid-number">{String(r.start).padStart(2, '0')}</text>
                <text x="30" y={y(r.start) + 4}>{r.driver.name_acronym || r.driver_number}</text>
                <text x="638" y={y(r.finish) + 4}>{r.driver.name_acronym || r.driver_number}</text>
                <text x="726" y={y(r.finish) + 4} textAnchor="end" className="results-grid-number">{String(r.finish).padStart(2, '0')}</text>
                <path d={path(r.start, r.finish)} stroke="transparent" strokeWidth="10" fill="none" className="results-path-target" />
              </g>)}
              {activeChange && <path key={`${active.driver_number}-${replay}`} d={path(activeChange.start, activeChange.finish)} className="results-active-path" pathLength="1" stroke="var(--driver-color)" strokeWidth="3" fill="none" pointerEvents="none" />}
            </svg>
            <p className="results-chart-footnote">Grid to final classification. Only classified finishers with a published grid position are shown.</p>
            {!activeChange && <RaceTrace row={active} extras={extras} />}
          </> : hasTrace ? <div className="results-large-trace"><RaceTrace key={active.driver_number} row={active} extras={extras} large /><p className="results-chart-footnote">Starting-grid comparison is not available for this session.</p></div> : <div className="results-story-empty"><p>The race story is not available for this session yet.</p><button type="button" className="results-replay" onClick={onRetry}>CHECK AGAIN ↗</button></div>}
        </div>
      </section>
    </>
  )
}
