'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useNextRace } from './useNextRace'
import { lockPageScroll } from '@/lib/scroll-lock'
import './navigation.css'

const GROUPS = [
  { id: 'season', title: 'Season', description: 'The calendar. The contenders.', links: [
    { label: 'Overview', href: '/' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Standings', href: '/standings' },
    { label: 'Drivers', href: '/drivers' },
    { label: 'Teams', href: '/teams' },
  ] },
  { id: 'weekend', title: 'Race weekend', description: 'Every session, in detail.', links: [
    { label: 'Results', href: '/results' },
    { label: 'Lap Times', href: '/laps' },
    { label: 'Positions', href: '/positions' },
    { label: 'Pit Stops', href: '/pit-stops' },
    { label: 'Tyres & Stints', href: '/stints' },
    { label: 'Weather', href: '/weather' },
    { label: 'Race Control', href: '/race-control' },
  ] },
  { id: 'play', title: 'Play', description: 'Your turn to make the calls.', links: [
    { label: 'Fantasy', href: '/fantasy', detail: 'Build your team. Chase the championship.' },
    { label: 'Predictions', href: '/predictions', detail: 'Call the weekend. Back your instinct.' },
  ] },
]

export default function MenuOverlay({ open, onClose, returnFocusTo }: {
  open: boolean
  onClose: () => void
  returnFocusTo?: React.RefObject<HTMLElement | null>
}) {
  const race = useNextRace()
  const pathname = usePathname()
  useEffect(() => { if (open) return lockPageScroll() }, [open])
  const ref = useFocusTrap<HTMLDivElement>({ active: open, onClose, returnFocusTo })

  return <div ref={ref} id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu"
    aria-hidden={!open} inert={!open} className={`site-menu ${open ? 'is-open' : ''}`}>
    {/* Native scrolling stays available inside the locked overlay, including short windows. */}
    <div className="site-menu-scroll" data-lenis-prevent>
      <div className="site-menu-intro"><p>FIND YOUR RACING LINE.</p><span>Explore LIGHTS OUT</span></div>
      <nav aria-label="Main navigation" className="site-menu-groups">
        {GROUPS.map((group, index) => <section key={group.id} className={`site-menu-group site-menu-${group.id}`} style={{ '--group-index': index } as React.CSSProperties} aria-labelledby={`menu-${group.id}`}>
          <div className="site-menu-group-title"><h2 id={`menu-${group.id}`}>{group.title}</h2><span aria-hidden>{String(index + 1).padStart(2, '0')}</span></div>
          <p className="site-menu-description">{group.description}</p>
          <ul>{group.links.map(link => {
            const active = link.href === '/' ? pathname === '/' : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return <li key={link.href}><TransitionLink href={link.href} onNavigate={onClose} aria-current={active ? 'page' : undefined} className="site-menu-link">
              <span className="site-menu-link-name">{link.label}</span><span className="site-menu-arrow" aria-hidden>↗</span>
              {'detail' in link && <span className="site-menu-game-detail">{link.detail}</span>}
            </TransitionLink></li>
          })}</ul>
          {group.id === 'play' && <p className="site-menu-play-note">Two games. One competitive streak.</p>}
        </section>)}
      </nav>
      <div className="site-menu-footer"><span>{race ? `SEASON ${race.seasonYear}` : 'LIGHTS OUT'}</span><span>THE WHOLE WEEKEND. EVERY ANGLE.</span><a href="https://github.com/nimzzzzz/f1-website" target="_blank" rel="noreferrer">GitHub ↗</a></div>
    </div>
  </div>
}
