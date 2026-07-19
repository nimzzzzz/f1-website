'use client'

import { useEffect, useState } from 'react'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useNextRace, shortRaceName } from './useNextRace'
import { useApiBlocked } from './useApiBlocked'

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

// Ticker typeface candidates under review (?ticker=A|B|C, ?round=full).
// Default (no param) stays the current label-mono. The data mono elsewhere
// is untouched — this styles the ticker strip only.
const TICKER_VARIANTS: Record<string, React.CSSProperties> = {
  A: {
    // Bebas — part of the headline system, broadcast
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
  },
  B: {
    // Space Grotesk — technical but drawn, wide-tracked
    fontFamily: 'var(--font-ticker-b)',
    fontWeight: 500,
    fontSize: '11.5px',
    letterSpacing: '0.26em',
    textTransform: 'uppercase',
  },
  C: {
    // Montserrat thin — editorial/luxury nav
    fontFamily: 'var(--font-ticker-c)',
    fontWeight: 200,
    fontSize: '11px',
    letterSpacing: '0.38em',
    textTransform: 'uppercase',
  },
}

export default function TopBar({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  const race = useNextRace()
  const apiBlocked = useApiBlocked()
  const [now, setNow] = useState(() => Date.now())
  const [variant, setVariant] = useState<string | null>(null)
  const [roundFull, setRoundFull] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  void now // re-render tick for the countdown string

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const t = q.get('ticker')?.toUpperCase() ?? null
    if (t && TICKER_VARIANTS[t]) setVariant(t)
    setRoundFull(q.get('round') === 'full')
  }, [])

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
          className={`${variant ? '' : 'label-mono'} absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[var(--text-dim)] md:flex`}
          style={variant ? TICKER_VARIANTS[variant] : undefined}
        >
          {race ? (
            <>
              <span>{roundFull ? `ROUND ${pad(race.round)}` : `R${pad(race.round)}`}</span>
              <span aria-hidden>—</span>
              <span className="text-[var(--text)]">{shortRaceName(race.meeting)}</span>
              <span aria-hidden>—</span>
              {race.isLive ? (
                <span className="flex items-center gap-1.5 text-[var(--accent)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                  LIVE
                </span>
              ) : race.raceStart ? (
                <span className="tabular-nums">{tickerCountdown(race.raceStart)}</span>
              ) : null}
            </>
          ) : apiBlocked ? (
            <span className="flex items-center gap-2 text-[var(--accent)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
              LIVE SESSION IN PROGRESS
            </span>
          ) : (
            <span aria-hidden>—</span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="group flex items-center gap-3 py-2 pl-3"
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
    </header>
  )
}
