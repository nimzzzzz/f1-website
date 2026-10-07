'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useNextRace, shortRaceName } from './useNextRace'
import './navigation.css'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function tickerCountdown(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return '00D 00H 00M'
  const total = Math.floor(diff / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${pad(d)}D ${pad(h)}H ${pad(m)}M`
}

// The ticker's own face: Space Grotesk, wide-tracked uppercase — technical
// like the data mono but with drawn letterforms. Ticker strip only; the
// data mono everywhere else is untouched.
const TICKER_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-ticker)',
  fontWeight: 500,
  fontSize: '11.5px',
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
}

export default function TopBar({
  menuOpen,
  triggerRef,
  onToggleMenu,
}: {
  menuOpen: boolean
  triggerRef?: React.RefObject<HTMLButtonElement | null>
  onToggleMenu: () => void
}) {
  const race = useNextRace()
  const [now, setNow] = useState(() => Date.now())
  const pathname = usePathname()
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return
    const controller = new AbortController()
    fetch('/api/account/profile', { signal: controller.signal, cache: 'no-store' })
      .then(response => { if (!controller.signal.aborted) setSignedIn(response.ok) })
      .catch(() => { /* Keep navigation available if the account service is offline. */ })
    return () => controller.abort()
  }, [pathname])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  void now // re-render tick for the countdown string

  return (
    <header className="fixed inset-x-0 top-0 z-[160] h-16 border-b border-[var(--line)] bg-[rgba(10,10,10,0.6)] backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-5 md:px-10">
        <TransitionLink
          href="/"
          onNavigate={menuOpen ? onToggleMenu : undefined}
          className="text-xl leading-none text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
        >
          LIGHTS OUT
        </TransitionLink>

        {/* live next-race ticker */}
        <div
          className="header-race-ticker absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[var(--text-dim)] md:flex"
          style={TICKER_STYLE}
        >
          {race ? (
            <>
              <span>ROUND {pad(race.round)}</span>
              <span aria-hidden>—</span>
              <span className="text-[var(--text)]">{shortRaceName(race.meeting)}</span>
              <span aria-hidden>—</span>
              {race.isLive ? (
                <span className="flex items-center gap-1.5 text-[var(--accent-text)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
                  LIVE
                </span>
              ) : race.raceStart ? (
                <span suppressHydrationWarning className="tabular-nums">
                  {tickerCountdown(race.raceStart)}
                </span>
              ) : null}
            </>
          ) : (
            <span aria-hidden>—</span>
          )}
        </div>

        <div className="header-actions">
        <TransitionLink href={signedIn ? '/account' : '/login'} onNavigate={menuOpen ? onToggleMenu : undefined}
          className="header-paddock" aria-current={pathname === (signedIn ? '/account' : '/login') ? 'page' : undefined}>
          <span>{signedIn ? 'My paddock' : 'Sign in'}</span><span aria-hidden>↗</span>
        </TransitionLink>
        <button
          ref={triggerRef}
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="tap-44 group flex items-center gap-3 py-2 pl-3"
        >
          <span className="label-mono text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
            {menuOpen ? 'CLOSE' : 'MENU'}
          </span>
          {/* two-line icon that morphs to an X */}
          <span className="relative block h-3 w-6" aria-hidden>
            <span
              className="absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300 ease-out group-hover:bg-[var(--accent)]"
              style={{
                transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none',
              }}
            />
            <span
              className="absolute bottom-0 left-0 h-px w-6 bg-current transition-transform duration-300 ease-out group-hover:bg-[var(--accent)]"
              style={{
                transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none',
              }}
            />
          </span>
        </button>
        </div>
      </div>
    </header>
  )
}
