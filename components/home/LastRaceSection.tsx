'use client'

import { ClipReveal, FadeUp } from '@/components/motion/reveals'

export interface PodiumRow {
  position: number
  surname: string
  fullName: string
  gapLabel: string // '' for the winner, '+2.394S' / '+1 LAP' for the rest
}

// Section 3 — "LAST TIME OUT". Winner huge, P2/P3 stacked small. The frame
// renders immediately with same-scale ghost type holding the layout; real
// content replaces it in place when the results land.
export default function LastRaceSection({
  raceLabel,
  podium,
  asOf = null,
}: {
  raceLabel: string | null
  podium: PodiumRow[] | null
  asOf?: string | null
}) {
  const winner = podium?.find((p) => p.position === 1)
  const rest = podium ? podium.filter((p) => p.position !== 1) : [2, 3]

  return (
    <section className="border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
      <FadeUp>
        <p className="label-mono mb-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--text-dim)]">
          LAST TIME OUT — {raceLabel ?? '——'}
          {podium && asOf && <span>AS OF {asOf}</span>}
        </p>
      </FadeUp>

      {/* keyed so arriving data remounts the reveals, in place */}
      <div
        key={podium ? 'live' : 'ghost'}
        className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr] md:items-end"
      >
        <ClipReveal>
          <p
            className="label-mono mb-3"
            style={{ color: podium ? 'var(--text-dim)' : 'rgba(245,245,243,0.15)' }}
          >
            WINNER
          </p>
          <p
            className="truncate uppercase leading-[0.85]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(4.5rem, 11vw, 11rem)',
              color: winner ? 'var(--text)' : 'rgba(245,245,243,0.08)',
            }}
            title={winner?.fullName}
          >
            {winner ? winner.surname : '———'}
          </p>
        </ClipReveal>

        <div className="space-y-8">
          {rest.map((p, i) => {
            const ghost = typeof p === 'number'
            const position = ghost ? (p as number) : (p as PodiumRow).position
            return (
              <FadeUp key={position} delay={0.15 + i * 0.1}>
                <div className="border-t border-[var(--line)] pt-4">
                  <p
                    className="label-mono"
                    style={{ color: ghost ? 'rgba(245,245,243,0.15)' : 'var(--text-dim)' }}
                  >
                    P{position}
                  </p>
                  <p
                    className="truncate uppercase leading-none"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.9rem, 3.6vw, 3.2rem)',
                      color: ghost ? 'rgba(245,245,243,0.08)' : 'var(--text)',
                    }}
                    title={ghost ? undefined : (p as PodiumRow).fullName}
                  >
                    {ghost ? '———' : (p as PodiumRow).surname}
                  </p>
                  <p
                    className="mt-1 font-mono text-sm tabular-nums"
                    style={{ color: ghost ? 'rgba(245,245,243,0.15)' : 'var(--text-dim)' }}
                  >
                    {ghost ? '—' : (p as PodiumRow).gapLabel}
                  </p>
                </div>
              </FadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
