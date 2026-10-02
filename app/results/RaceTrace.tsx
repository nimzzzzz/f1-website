'use client'

import { useMemo, type CSSProperties } from 'react'
import { driverTrace, teamColor, type ResultRow } from '@/lib/results-story'
import type { RaceExtras } from '@/lib/results-data'

export default function RaceTrace({ row, extras, large = false }: { row: ResultRow; extras: RaceExtras | null; large?: boolean }) {
  const trace = useMemo(() => driverTrace(extras?.positions ?? [], extras?.stops ?? [], row.driver_number), [extras, row.driver_number])
  if (!trace || trace.points.length < 2) return <p className="results-note">Race progression is not available for this driver.</p>
  const width = 760, height = large ? 310 : 170, left = 34, right = 740, top = 22, bottom = height - 28
  const max = Math.max(20, ...trace.points.map((p) => p.position))
  const x = (n: number) => left + n * (right - left)
  const y = (p: number) => top + (p - 1) / (max - 1) * (bottom - top)
  const path = trace.points.map((p, i) => `${i ? 'H' : 'M'}${x(p.x).toFixed(2)}${i ? `V${y(p.position).toFixed(2)}` : `,${y(p.position).toFixed(2)}`}`).join(' ')
  return (
    <figure className="results-trace" style={{ '--driver-color': teamColor(row.driver) } as CSSProperties}>
      <figcaption><span>RECORDED POSITION</span><span>BEST P{trace.best}</span></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${row.driver.full_name}: best recorded position ${trace.best}, over ${trace.minutes} minutes. Pit stops are marked below.`}>
        {[1, 10, max].map((p) => <g key={p}><line x1={left} x2={right} y1={y(p)} y2={y(p)} className="results-chart-rule" /><text x="0" y={y(p) + 4}>P{p}</text></g>)}
        <path d={path} fill="none" stroke="var(--driver-color)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="results-trace-path" pathLength="1" />
        {trace.pits.map((p, i) => <g key={i}><line x1={x(p.x)} x2={x(p.x)} y1={top} y2={bottom} stroke="var(--text-dim)" strokeDasharray="2 5" /><circle cx={x(p.x)} cy={bottom} r="3" fill="var(--text)" /></g>)}
        <text x={left} y={height - 4}>FIRST TIMING</text><text x={right} y={height - 4} textAnchor="end">{trace.minutes} MIN</text>
      </svg>
      {extras?.stops && <p className="results-trace-stops">{extras.stops.filter((p) => p.driver_number === row.driver_number).length ? `PIT LAPS ${extras.stops.filter((p) => p.driver_number === row.driver_number).map((p) => p.lap_number).join(' · ')}` : 'NO PIT STOPS RECORDED'}</p>}
    </figure>
  )
}
