'use client'

import { useEffect, useRef } from 'react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useNextRace } from './useNextRace'

gsap.registerPlugin(useGSAP)

const ROUTES: Array<{ label: string; href: string }> = [
  { label: 'Overview', href: '/' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Standings', href: '/standings' },
  { label: 'Drivers', href: '/drivers' },
  { label: 'Teams', href: '/teams' },
  { label: 'Results', href: '/results' },
  { label: 'Lap Times', href: '/laps' },
  { label: 'Positions', href: '/positions' },
  { label: 'Pit Stops', href: '/pit-stops' },
  { label: 'Tyres & Stints', href: '/stints' },
  { label: 'Weather', href: '/weather' },
  { label: 'Race Control', href: '/race-control' },
  // Neither /sports-cards nor /highlights appears here. /highlights was
  // deleted outright (dead for months — its API 500s without a key that was
  // never set). /sports-cards still resolves for anyone holding the link,
  // but is a COMING SOON placeholder and is not promoted in the site's own
  // navigation until it has content.
]

export default function MenuOverlay({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean
  onClose: () => void
  /** The control that opened the menu; focus returns here on close. */
  returnFocusTo?: React.RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const race = useNextRace()
  const firstRender = useRef(true)

  // scroll lock while open (Lenis observes body style and stops itself)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  // The dialog kept its promise only on paper: role="dialog" and
  // aria-modal="true" tell assistive tech the rest of the page is inert,
  // while Tab walked straight out of it into the page behind. The shared
  // trap (the same one SessionPicker uses) moves focus in, cycles it, marks
  // the background inert, and returns focus to the trigger on close —
  // whether that close came from Escape or a click.
  const trapRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onClose,
    returnFocusTo,
  })

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const items = el.querySelectorAll('[data-menu-item]')
      const footer = el.querySelector('[data-menu-footer]')
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (firstRender.current) {
        firstRender.current = false
        gsap.set(el, { display: 'none', autoAlpha: 0 })
        return
      }

      if (open) {
        if (reduced) {
          gsap.set(el, { display: 'flex', autoAlpha: 1 })
          gsap.set([...items, footer], { clipPath: 'none', autoAlpha: 1, y: 0 })
          return
        }
        gsap
          .timeline()
          .set(el, { display: 'flex' })
          .to(el, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' })
          .fromTo(
            items,
            { clipPath: 'inset(0 0 100% 0)', y: 18 },
            {
              clipPath: 'inset(0 0 -10% 0)',
              y: 0,
              duration: 0.55,
              stagger: 0.035,
              ease: 'power4.out',
            },
            '-=0.1'
          )
          .fromTo(
            footer,
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' },
            '-=0.35'
          )
      } else {
        gsap.to(el, {
          autoAlpha: 0,
          duration: reduced ? 0 : 0.22,
          ease: 'power2.in',
          onComplete: () => gsap.set(el, { display: 'none' }),
        })
      }
    },
    { scope: ref, dependencies: [open] }
  )

  return (
    <div
      ref={(node) => {
        ref.current = node
        trapRef.current = node
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      // pure black takeover — allowed here by the token rules
      className="fixed inset-0 z-[150] hidden flex-col bg-black pt-20"
    >
      {/* data-lenis-prevent: the menu locks page scroll, LenisProvider
          answers with lenis.stop(), and a stopped Lenis preventDefaults
          EVERY wheel event on the document — including ones aimed at this
          nav. Without it the wheel is dead in here wherever the list
          overflows, which at 1440x900 it does not, so the bug only
          surfaces on short windows and phones in landscape. Measured
          scrollable and unscrollable-by-wheel at 1280x420 and 390x560. */}
      <nav data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain px-6 md:px-14">
        <ul>
          {ROUTES.map(({ label, href }, i) => (
            <li key={href} data-menu-item className="overflow-hidden">
              <TransitionLink
                href={href}
                onNavigate={onClose}
                className="group flex items-baseline gap-4 py-0.5 text-[var(--text)] transition-[transform,color] duration-300 ease-out hover:translate-x-3 hover:text-[var(--accent)]"
              >
                <span
                  className="label-mono w-7 shrink-0 text-[var(--text-dim)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="uppercase leading-[1.05]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2rem, min(5.5vw, 5.2vh), 4.5rem)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {label}
                </span>
              </TransitionLink>
            </li>
          ))}
        </ul>
      </nav>

      <div
        data-menu-footer
        className="label-mono flex items-center justify-between border-t border-[var(--line)] px-6 py-5 text-[var(--text-dim)] md:px-14"
      >
        <a
          href="https://github.com/nimzzzzz/f1-website"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[var(--accent)]"
        >
          GitHub ↗
        </a>
        {/* season year comes from loaded season data, not the system clock */}
        <span>{race ? `Season ${race.seasonYear}` : ''}</span>
      </div>
    </div>
  )
}
