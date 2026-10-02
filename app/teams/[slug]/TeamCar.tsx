'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { carImageHi } from '@/lib/media-manifest'

// Crops stay inside the actual side-on render. The visitor chooses the
// camera; scrolling never moves the car underneath the page.
const VIEWS = [
  { id: 'full', label: 'Full car', caption: 'The complete livery', scale: 1, x: 0, y: 0 },
  { id: 'cockpit', label: 'Cockpit', caption: 'Cockpit & halo', scale: 2.5, x: -8, y: 45 },
  { id: 'rear', label: 'Rear detail', caption: 'Rear wing & engine cover', scale: 2.1, x: 55, y: 40 },
  { id: 'front', label: 'Front wing', caption: 'Front wing & nose', scale: 2.5, x: -92, y: -40 },
] as const

export default function TeamCar({ slug, name }: { slug: string; name: string }) {
  const [selected, setSelected] = useState(0)
  const [ready, setReady] = useState(false)
  const car = carImageHi(slug)
  const view = VIEWS[selected]
  if (!car) return <div className="team-car-missing">The {name} car render is coming soon.</div>

  return <div className="team-car" data-car-ready={ready} data-car-view={view.id}>
    <div className="team-car-stage">
      <div className="team-car-light" aria-hidden="true" />
      <div className="team-car-floor" aria-hidden="true" />
      <div className="team-car-camera" style={{ '--car-scale': view.scale, '--car-x': `${view.x}%`, '--car-y': `${view.y}%` } as CSSProperties}>
        <div className="team-car-arrival"><Image src={car} alt={`${name} Formula 1 car, ${view.caption.toLowerCase()}`} fill sizes={selected === 0 ? '100vw' : '(min-width: 768px) 250vw, 325vw'} loading="eager" fetchPriority="high" onLoad={() => setReady(true)} /></div>
      </div>
    </div>
    <div className="team-car-console">
      <span className="team-label team-car-caption" aria-live="polite">{view.caption}</span>
      <div className="team-car-views" role="group" aria-label="Inspect the car">
        {VIEWS.map((option, i) => <button key={option.id} type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>{option.label}<span aria-hidden="true">{i === 0 ? '↗' : '+'}</span></button>)}
      </div>
    </div>
  </div>
}
