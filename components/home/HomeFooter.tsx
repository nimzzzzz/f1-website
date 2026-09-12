'use client'

import { TransitionLink } from '@/components/motion/TransitionProvider'

export default function HomeFooter({ seasonYear }: { seasonYear: number | null }) {
  return <footer className="home-footer">
    <div className="home-width">
      <div className="home-footer-top"><p>For the love of racing.</p><nav aria-label="Footer navigation"><TransitionLink href="/drivers">Drivers</TransitionLink><TransitionLink href="/teams">Teams</TransitionLink><TransitionLink href="/schedule">Full calendar</TransitionLink></nav></div>
      <TransitionLink href="/" className="home-footer-wordmark" aria-label="Lights Out home">LIGHTS OUT<span aria-hidden="true">↗</span></TransitionLink>
      <div className="home-footer-bottom"><span>{seasonYear !== null ? `THE ${seasonYear} FORMULA 1 SEASON` : 'THE WORLD OF FORMULA 1'}</span><div><a href="https://openf1.org" target="_blank" rel="noreferrer">DATA: OPENF1</a><a href="https://github.com/nimzzzzz/f1-website" target="_blank" rel="noreferrer">GITHUB ↗</a></div></div>
    </div>
  </footer>
}
