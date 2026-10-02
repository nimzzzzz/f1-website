'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { carImage, carImageHi, driverImage } from '@/lib/media-manifest'
import { teamToSlug } from '@/lib/team-data'
import { pitTime, type PitMetric, type PitVisit } from '@/lib/pit-story'
import type { Stint } from '@/lib/openf1'
import PitTyres from './PitTyres'

export default function PitGarage({ visit, metric, best, stints, titleRef, replaySignal }: {
  visit: PitVisit; metric: PitMetric; best: PitVisit | undefined; stints: Stint[] | null;
  titleRef: RefObject<HTMLHeadingElement | null>; replaySignal: number;
}) {
  const root = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const carRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [replay, setReplay] = useState(0)
  const [phase, setPhase] = useState('RECORDED')
  const [reduced, setReduced] = useState(false)
  const car = carImageHi(teamToSlug(visit.team))
  const compactCar = carImage(teamToSlug(visit.team))
  const portrait = driverImage(visit.acronym)
  const duration = visit[metric]
  const longTime = duration !== null && Math.round(duration * 100) >= 6000
  const bestHere = duration !== null && duration === best?.[metric]

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: .2 })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  useGSAP(() => {
    if (!visible || (car && !ready) || duration === null) return
    const mm = gsap.matchMedia()
    mm.add({ reduced: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const reduce = Boolean(context.conditions?.reduced)
      setReduced(reduce)
      if (reduce) { setPhase('RECORDED'); return }
      const counter = { value: 0 }
      const zero = longTime ? '0:00.00' : '0.00'
      if (clock.current) clock.current.textContent = zero
      const service = Math.min(duration, 3.5)
      const length = metric === 'stationary' ? service + 1.5 : 3.2
      const tl = gsap.timeline()
      tl.call(() => setPhase('PIT ENTRY'))
        .set(carRef.current, { xPercent: -135, autoAlpha: 1 })
        .to(carRef.current, { xPercent: 0, duration: .75, ease: 'power2.out' })
        .call(() => setPhase(metric === 'stationary' ? 'STATIONARY' : 'IN PIT LANE'))
      if (metric === 'stationary') tl.to({}, { duration: service })
      else tl.to(carRef.current, { xPercent: 25, duration: 1.7, ease: 'none' })
      tl.call(() => setPhase('PIT EXIT'))
        .to(carRef.current, { xPercent: 140, duration: .75, ease: 'power2.in' })
        .call(() => setPhase('RECORDED'))
        .set(carRef.current, { xPercent: 0, autoAlpha: 0 })
        .to(carRef.current, { autoAlpha: 1, duration: .45, delay: .15 })
      tl.to(counter, {
        value: duration, duration: metric === 'stationary' ? service : length, ease: 'none',
        onUpdate: () => { if (clock.current) clock.current.textContent = counter.value < .005 ? zero : pitTime(counter.value, longTime) },
      }, metric === 'stationary' ? .75 : 0)
      return () => { if (clock.current) clock.current.textContent = pitTime(duration) }
    })
    return () => mm.revert()
  }, { scope: root, dependencies: [visible, ready, duration, metric, replay, replaySignal, car, longTime], revertOnUpdate: true })

  return <div ref={root} className="pit-garage" style={{ '--pit-team': visit.color } as CSSProperties} data-phase={phase}>
    <div className="pit-bay">
      <div className="pit-bay-title"><h2 ref={titleRef} tabIndex={-1}>BOX. BOX.</h2><span className="pit-label">THE PIT LANE</span></div>
      <div className="pit-bay-grid" aria-hidden />
      <div className="pit-bay-mark" aria-hidden><span>STOP</span></div>
      <div className="pit-car-track"><div ref={carRef} className="pit-car">
        {car ? <picture>{compactCar && <source media="(max-width: 420px)" srcSet={compactCar} />}<Image src={car} alt={`${visit.team} Formula 1 car`} fill unoptimized loading="eager" fetchPriority="high" onLoad={() => setReady(true)} /></picture> : <span className="pit-missing-car">{visit.acronym}</span>}
      </div></div>
      <div className="pit-bay-line" aria-hidden />
      <div className="pit-bay-console">
        <span className="pit-phase"><i aria-hidden />{phase}</span>
        <button type="button" className="pit-action" disabled={duration === null || reduced} onClick={() => setReplay(r => r + 1)}>{reduced ? 'MOTION REDUCED' : 'REPLAY VISIT'}<span aria-hidden>↗</span></button>
      </div>
    </div>
    <div className="pit-board">
      <div className="pit-board-heading"><span className="pit-label">{bestHere ? metric === 'stationary' ? 'FASTEST STATIONARY STOP' : 'FASTEST LANE VISIT' : 'SELECTED VISIT'}</span><span className="pit-board-lap">L{visit.lap ?? '?'}</span></div>
      <div className={`pit-clock${longTime ? ' is-long' : ''}`}><span ref={clock} aria-hidden>{pitTime(duration)}</span><small aria-hidden>{longTime ? 'MIN:SEC' : 'SEC'}</small><span className="sr-only">{metric === 'stationary' ? 'Stationary time' : 'Total pit-lane time'}: {duration === null ? 'unavailable' : `${duration.toFixed(2)} seconds`}</span></div>
      <span className="pit-clock-label">{metric === 'stationary' ? 'STATIONARY TIME' : 'TOTAL TIME IN PIT LANE'}</span>
      <div className="pit-board-driver">
        {portrait && <span className="pit-board-portrait" aria-hidden><Image src={portrait} alt="" fill unoptimized /></span>}
        <div><h3>{visit.surname}</h3><span>{visit.team}</span></div><span className="pit-driver-number">{visit.number}</span>
      </div>
      <dl className="pit-board-times"><div><dt>STATIONARY</dt><dd>{pitTime(visit.stationary)}{visit.stationary !== null && visit.stationary < 60 && <small>s</small>}</dd></div><div><dt>PIT LANE</dt><dd>{pitTime(visit.lane)}{visit.lane !== null && visit.lane < 60 && <small>s</small>}</dd></div></dl>
      <div className="pit-board-bottom"><PitTyres visit={visit} stints={stints} /><span className="pit-label">VISIT {visit.ordinal} / {visit.total}</span></div>
    </div>
    <p className="pit-garage-note">Condensed illustration. Car movement is illustrative; the timing comes from the selected visit.</p>
  </div>
}
