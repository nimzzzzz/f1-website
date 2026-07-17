'use client'

import { ClipReveal, FadeUp } from '@/components/motion/reveals'

export interface PodiumRow {
  position: number
  surname: string
  fullName: string
  gapLabel: string // '' for the winner, '+2.394S' / '+1 LAP' for the rest
}

// Section 3 — "LAST TIME OUT". Winner huge, P2/P3 stacked small.
export default function LastRaceSection({
  raceLabel,
  podium,
}: {
  raceLabel: string
  podium: PodiumRow[]
}) {
  const winner = podium.find((p) => p.position === 1)
  const rest = podium.filter((p) => p.position !== 1)

  return (
    <section className="border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
      <FadeUp>
        <p className="label-mono mb-12 text-[var(--text-dim)]">LAST TIME OUT — {raceLabel}</p>
      </FadeUp>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr] md:items-end">
        {winner && (
          <ClipReveal>
            <p className="label-mono mb-3 text-[var(--text-dim)]">WINNER</p>
            <p
              className="uppercase leading-[0.85] text-[var(--text)]"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(4.5rem, 11vw, 11rem)',
              }}
              title={winner.fullName}
            >
              {winner.surname}
            </p>
          </ClipReveal>
        )}

        <div className="space-y-8">
          {rest.map((p, i) => (
            <FadeUp key={p.position} delay={0.15 + i * 0.1}>
              <div className="border-t border-[var(--line)] pt-4">
                <p className="label-mono text-[var(--text-dim)]">P{p.position}</p>
                <p
                  className="uppercase leading-none text-[var(--text)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.9rem, 3.6vw, 3.2rem)',
                  }}
                  title={p.fullName}
                >
                  {p.surname}
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-[var(--text-dim)]">
                  {p.gapLabel}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
