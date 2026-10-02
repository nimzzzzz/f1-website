'use client'

import { useEffect, useRef, useState } from 'react'
import { idealLap, lapTime, sectorTime, sectors, type LapDriver } from '@/lib/laps-story'

export default function IdealLap({ driver }: { driver: LapDriver }) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { threshold: .25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const ideal = idealLap(driver.laps)
  return <section ref={ref} className={`laps-ideal${visible ? ' is-visible' : ''}`} aria-labelledby="laps-ideal-title">
    <div className="laps-ideal-intro"><h2 id="laps-ideal-title">THE LAP THAT<br />COULD HAVE BEEN.</h2><p>{driver.name}&apos;s best sectors from this session, brought together.</p></div>
    {ideal ? <div className="laps-ideal-equation" key={driver.number}>
      <div className="laps-ideal-parts">{ideal.parts.map((lap, i) => <div key={i} style={{ animationDelay: `${i * .12}s` }}><span className="laps-caption">S{i + 1} · LAP {lap.lap_number}</span><strong>{sectorTime(lap[sectors[i]])}</strong></div>)}</div>
      <div className="laps-ideal-total"><div><span className="laps-caption">THEORETICAL BEST</span><strong>{lapTime(ideal.total)}</strong></div><div><span className="laps-caption">POTENTIAL GAIN</span><strong>{ideal.gain.toFixed(3)}<small>s</small></strong></div></div>
      <p className="laps-note">Actual best {lapTime(ideal.best.lap_duration)}. Combines separate laps and conditions, not a completed lap.</p>
    </div> : <p className="laps-note">A theoretical lap needs sufficient recorded sector times. Select another driver to explore theirs.</p>}
  </section>
}
