'use client'

import { useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { lapKey, lapTime, sectorDuel, sectorTime, type LapDriver, type TimedLap } from '@/lib/laps-story'

export default function SectorDuel({ a, b, driverA, driverB }: { a: TimedLap; b: TimedLap; driverA: LapDriver; driverB: LapDriver }) {
  const ref = useRef<HTMLDivElement>(null)
  const [replay, setReplay] = useState(0)
  const [step, setStep] = useState(3)
  const splits = sectorDuel(a, b)
  const signature = `${lapKey(a)}:${a.lap_duration}:${lapKey(b)}:${b.lap_duration}:${splits.map((s) => `${s.a},${s.b}`).join(';')}`
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      setStep(0)
      const tl = gsap.timeline()
      gsap.set('.laps-sector-fill', { scaleX: 0, transformOrigin: 'left center' })
      splits.forEach((split, i) => {
        const max = Math.max(split.a ?? 0, split.b ?? 0, 1)
        tl.to(`[data-sector="${i}"] [data-lane="a"]`, { scaleX: 1, duration: .8 * (split.a ?? max) / max, ease: 'none' }, i * 1.05)
          .to(`[data-sector="${i}"] [data-lane="b"]`, { scaleX: 1, duration: .8 * (split.b ?? max) / max, ease: 'none' }, i * 1.05)
          .call(() => setStep(i + 1), [], i * 1.05 + .85)
      })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => { setStep(3); gsap.set('.laps-sector-fill', { scaleX: 1 }) })
    return () => mm.revert()
  }, { scope: ref, dependencies: [signature, replay], revertOnUpdate: true })

  const finalGap = b.lap_duration - a.lap_duration
  const currentGap = step === 3 ? finalGap : step === 0 ? 0 : splits[step - 1].gap
  const leader = currentGap !== null && Math.round(currentGap * 1000) !== 0 ? (currentGap > 0 ? driverA : driverB) : null
  return <div className="laps-duel" ref={ref} style={{ '--lap-a': driverA.color, '--lap-b': driverB.color } as CSSProperties}>
    <div className="laps-duel-toolbar"><h3>SECTOR DUEL</h3><button className="laps-button" type="button" onClick={() => setReplay((v) => v + 1)}>REPLAY SPLITS <span aria-hidden>↗</span></button></div>
    <div className="laps-sectors">
      {splits.map((split, i) => {
        const max = Math.max(split.a ?? 0, split.b ?? 0, 1)
        const complete = step > i
        const sectorGap = split.a !== null && split.b !== null ? split.b - split.a : null
        return <div key={i} className={`laps-sector${complete ? ' is-complete' : ''}`} data-sector={i}>
          <div className="laps-sector-heading"><span>SECTOR</span><strong>0{i + 1}</strong></div>
          {(['a', 'b'] as const).map((lane) => <div className={`laps-sector-lane laps-sector-lane--${lane}`} key={lane}>
            <div><span>{lane === 'a' ? driverA.acronym : driverB.acronym}</span><strong>{sectorTime(split[lane])}</strong></div>
            <div className="laps-sector-rail" aria-hidden><span style={{ width: `${(split[lane] ?? 0) / max * 100}%` }}><i className="laps-sector-fill" data-lane={lane} /></span></div>
          </div>)}
          <p className="laps-split-gap"><strong>{!complete ? 'SPLIT PENDING' : sectorGap === null ? 'SECTOR UNAVAILABLE' : Math.round(sectorGap * 1000) === 0 ? 'IDENTICAL SECTOR' : `${sectorGap > 0 ? driverA.acronym : driverB.acronym} GAINS ${Math.abs(sectorGap).toFixed(3)}s`}</strong><span>{split.gap === null ? 'GAP UNAVAILABLE' : !complete ? 'GAP PENDING' : Math.round(split.gap * 1000) === 0 ? 'LEVEL AT SPLIT' : `${split.gap > 0 ? driverA.acronym : driverB.acronym} LEADS ${Math.abs(split.gap).toFixed(3)}s`}</span></p>
        </div>
      })}
    </div>
    <div className="laps-duel-finish">
      <div className="laps-duel-gap" role="status" aria-live="polite" aria-atomic="true">
        <span className="laps-caption">{step === 3 ? 'AT THE LINE' : step === 0 ? 'LIGHTS OUT' : `AFTER SECTOR ${step}`}</span>
        <strong>{currentGap === null ? 'N/A' : Math.abs(currentGap).toFixed(3)}<small>s</small></strong>
        <span>{currentGap === null ? 'Cumulative split unavailable' : leader ? `${leader.surname} ${step === 3 ? 'quicker' : 'ahead'}` : 'Nothing between them'}</span>
      </div>
      <div className="laps-duel-times"><p><span><i style={{ background: driverA.color }} />{driverA.acronym} · L{a.lap_number}</span><strong>{lapTime(a.lap_duration)}</strong></p><p><span><i style={{ background: driverB.color }} />{driverB.acronym} · L{b.lap_number}</span><strong>{lapTime(b.lap_duration)}</strong></p></div>
    </div>
    <p className="laps-note">Split replay is condensed. Bars show sector duration; shorter is quicker. Gaps are cumulative.</p>
  </div>
}
