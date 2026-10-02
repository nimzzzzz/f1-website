'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Lap } from '@/lib/openf1'
import type { LapContext } from '@/lib/laps-data'
import { lapTime, pacePath, paceWindow, pitOnLap, timedLaps, type LapDriver } from '@/lib/laps-story'
import { Tyre } from './LapIdentity'

export default function LapPace({ drivers, context, onUse }: {
  drivers: LapDriver[]; context: LapContext | null; onUse: (slot: number, lap: Lap) => void;
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [focused, setFocused] = useState(true)
  const [cursor, setCursor] = useState(() => {
    const common = timedLaps(drivers[0]?.laps ?? []).filter((lap) => drivers.every((d) => timedLaps(d.laps).some((l) => l.lap_number === lap.lap_number)))
    return common.at(-1)?.lap_number ?? drivers[0]?.best.lap_number ?? 1
  })
  const window = useMemo(() => paceWindow(drivers, focused), [drivers, focused])
  const activeLap = Math.min(cursor, window.lastLap)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const left = width < 500 ? 49 : 62, right = 14, top = 18, bottom = 244, height = 276
  const x = (n: number) => left + (n - 1) / Math.max(1, window.lastLap - 1) * (width - left - right)
  const y = (n: number) => top + (n - window.min) / (window.max - window.min) * (bottom - top)
  const ticks = width < 500 ? 3 : 6
  const signature = drivers.map((d) => d.number).join('-')
  return <section className="laps-pace" aria-labelledby="laps-pace-title">
    <div className="laps-section-heading"><h2 id="laps-pace-title">PACE, LAP BY LAP.</h2><p>Follow the rhythm. Select a lap to inspect it or bring it into the duel.</p></div>
    <div className="laps-pace-toolbar"><div className="laps-legend">{drivers.map((d, i) => <span key={d.number}><i style={{ background: d.color }} />{i === 0 ? 'A' : 'B'} · {d.acronym}{i === 1 && <span className="laps-dash-key" aria-hidden />}</span>)}</div><label className="laps-toggle"><input type="checkbox" checked={focused} onChange={(e) => setFocused(e.target.checked)} /> FOCUS ON PACE</label></div>
    <div ref={ref} className="laps-plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Lap times for ${drivers.map((d) => d.name).join(' and ')}. Use the lap slider below to inspect values.`}
        onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const local = (event.clientX - rect.left) / rect.width * width; setCursor(Math.max(1, Math.min(window.lastLap, Math.round((local - left) / (width - left - right) * (window.lastLap - 1) + 1)))) }}>
        {[0, 1, 2, 3, 4].map((n) => { const value = window.min + (window.max - window.min) * n / 4; return <g key={n}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="laps-plot-rule" /><text x={left - 9} y={y(value) + 4} textAnchor="end">{lapTime(value).slice(0, -2)}</text></g> })}
        {Array.from(new Set(Array.from({ length: ticks }, (_, i) => Math.round(1 + (window.lastLap - 1) * i / (ticks - 1))))).map((n) => <text key={n} x={x(n)} y={height - 7} textAnchor="middle">L{n}</text>)}
        {drivers.map((driver, slot) => {
          const laps = window.visible.filter((l) => l.driver_number === driver.number)
          return <g key={`${signature}-${driver.number}`}>
            {context?.stops?.filter((s) => s.driver_number === driver.number && s.session_key === driver.best.session_key && s.lap_number >= 1 && s.lap_number <= window.lastLap).map((stop, i) => <g key={`pit-${i}`}>
              <line x1={x(stop.lap_number)} x2={x(stop.lap_number)} y1={top} y2={bottom} stroke={driver.color} strokeOpacity=".3" strokeDasharray="2 5" />
              <text x={x(stop.lap_number)} y={top + slot * 14} textAnchor="middle" className="laps-pit-label">P</text>
            </g>)}
            <path className="laps-pace-path" d={pacePath(laps, x, y)} fill="none" stroke={driver.color} strokeWidth="1.8" strokeDasharray={slot === 1 ? '5 4' : undefined} />
            {laps.map((lap) => <g key={lap.lap_number}>
              <circle cx={x(lap.lap_number)} cy={y(lap.lap_duration)} r={lap.lap_number === activeLap ? 5 : 2.3} fill={driver.color} stroke={lap.lap_number === activeLap ? '#f5f5f3' : 'none'} strokeWidth="2" />
            </g>)}
          </g>
        })}
        <line x1={x(activeLap)} x2={x(activeLap)} y1={top} y2={bottom} className="laps-cursor" />
      </svg>
    </div>
    <div className="laps-seek"><label htmlFor="laps-seek">LAP <strong>{String(activeLap).padStart(2, '0')}</strong></label><input id="laps-seek" type="range" min="1" max={window.lastLap} value={activeLap} onChange={(e) => setCursor(Number(e.target.value))} aria-valuetext={`Lap ${activeLap}`} /><span>{window.lastLap}</span></div>
    <div className="laps-inspected">{drivers.map((driver, slot) => {
      const lap = driver.laps.find((l) => l.lap_number === activeLap)
      return <div key={driver.number}>
        <span className="laps-caption"><i style={{ background: driver.color }} />{driver.acronym} · LAP {activeLap}</span>
        <strong>{lapTime(lap?.lap_duration)}</strong>
        <span className="laps-inspected-status">{lap?.is_pit_out_lap ? 'OUT LAP' : lap && pitOnLap(lap, context?.stops ?? null) ? 'PIT STOP' : !lap ? 'NO RECORDED LAP' : 'RECORDED LAP'}</span>
        {lap && <Tyre lap={lap} stints={context?.stints ?? null} />}
        <button type="button" className="laps-button" disabled={!lap?.lap_duration || lap.is_pit_out_lap} onClick={() => lap && onUse(slot, lap)}>USE IN DUEL {slot === 0 ? 'A' : 'B'} <span aria-hidden>↗</span></button>
      </div>
    })}</div>
    {drivers.some((d) => context?.stints?.some((s) => s.driver_number === d.number && s.session_key === d.best.session_key)) && <div className="laps-stint-map" aria-label="Recorded tyre stints">
      {drivers.map((driver) => <div className="laps-stint-row" key={driver.number}><span>{driver.acronym}</span><div>
        {context?.stints?.filter((s) => s.driver_number === driver.number && s.session_key === driver.best.session_key && s.lap_start > 0 && s.lap_end >= s.lap_start).map((s) => <span key={`${s.stint_number}-${s.lap_start}`} className={`laps-stint laps-stint--${s.compound?.toLowerCase()}`} style={{ left: `${(s.lap_start - 1) / window.lastLap * 100}%`, width: `${(Math.min(s.lap_end, window.lastLap) - s.lap_start + 1) / window.lastLap * 100}%` }} title={`${driver.name}: ${s.compound}, laps ${s.lap_start} to ${s.lap_end}`}><span>{s.compound?.[0] ?? '?'}</span></span>)}
      </div></div>)}
      <p className="laps-note">Tyres: S soft · M medium · H hard · I intermediate · W wet. P marks a recorded pit stop.</p>
    </div>}
    <p className="laps-note">{focused ? `Focus range includes laps within 115% of each driver's best. ${window.hidden} slower ${window.hidden === 1 ? 'lap is' : 'laps are'} outside this view.` : 'Full recorded timing range.'} Out laps are excluded from the graph. Gaps in the line represent missing or excluded laps. Tyres, traffic and fuel load affect comparisons.</p>
  </section>
}
