'use client'

import Image from 'next/image'
import { FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

const tools = [
  { title: 'Lap Times', href: '/laps', copy: 'Find the pace. Follow the progression.' },
  { title: 'Positions', href: '/positions', copy: 'Every move through the field.' },
  { title: 'Tyres & Stints', href: '/stints', copy: 'The strategy behind the result.' },
  { title: 'Pit Stops', href: '/pit-stops', copy: 'Where fractions make the difference.' },
]

export default function RaceToolsSection() {
  return <section className="race-tools home-width" aria-labelledby="tools-title">
    <FadeUp className="race-tools-story">
      <Image src="/media/garage.jpg" alt="Formula 1 team working in the garage" fill sizes="(max-width: 767px) 100vw, 45vw" />
      <div><p className="label-mono">CLOSER TO THE RACE</p><h2 id="tools-title">Read between<br />the lap times.</h2><TransitionLink href="/race-control" className="race-button race-button-outline">Race Control <span aria-hidden="true">↗</span></TransitionLink></div>
    </FadeUp>
    <div className="race-tools-links">{tools.map((tool, i) => <FadeUp key={tool.href} delay={i * 0.06}><TransitionLink href={tool.href} className="race-tool"><div><h3>{tool.title}</h3><p>{tool.copy}</p></div><span aria-hidden="true">↗</span></TransitionLink></FadeUp>)}</div>
  </section>
}
