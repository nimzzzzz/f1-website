'use client'

import { useState } from 'react'
import Image from 'next/image'

/** One coordinated race-start scene. CSS owns the frames; React only owns pause/replay. */
export default function GridEntrance() {
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)
  return <section className={`grid-entrance ${paused ? 'is-paused' : ''}`} aria-label="Your place on the grid">
    <div className="grid-scene" key={run}>
      <div className="grid-light-wash" aria-hidden />
      <div className="grid-start-lights" aria-hidden>{[0, 1, 2, 3, 4].map(i => <span key={i} style={{ '--light-cycle': `grid-light-${i}` } as React.CSSProperties}><i /><i /></span>)}</div>
      <div className="grid-entrance-copy"><p>THE WEEKEND IS YOURS.</p><h1>YOUR NAME.<br /><span>ON THE GRID.</span></h1><p className="grid-entrance-subtitle">Build your team. Back your instinct.<br />Make every race personal.</p></div>
      <div className="grid-runway" aria-hidden><div className="grid-runway-lines" /><div className="grid-position-mark" /><div className="grid-speed-lines"><i /><i /><i /></div></div>
      {/* Already a small, transparent WebP. Keep its original detail instead of recompressing it. */}
      <div className="grid-race-car"><Image src="/media/cars/ferrari.webp" alt="Ferrari Formula 1 car on the starting grid" width={1280} height={282} preload unoptimized /></div>
      <div className="grid-launch-word" aria-hidden>LIGHTS OUT.</div>
    </div>
    <div className="grid-motion-controls"><span className="grid-motion-caption">FIVE LIGHTS. ENDLESS POSSIBILITIES.</span><div><button type="button" onClick={() => { setRun(r => r + 1); setPaused(false) }}>Replay start <span aria-hidden>↗</span></button><button type="button" onClick={() => setPaused(p => !p)}>{paused ? 'Resume animation' : 'Pause animation'}</button></div></div>
  </section>
}
