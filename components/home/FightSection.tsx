'use client'

import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

export interface FightRow {
  position: number
  surname: string
  fullName: string
  points: number
  wins: number
}

// Section 2 — "THE FIGHT". Championship top 3 as a full-bleed typographic
// monument. P1 wears the accent; that is the accent's whole job here.
export default function FightSection({ rows }: { rows: FightRow[] }) {
  return (
    <section className="border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
      <FadeUp>
        <p className="label-mono mb-12 text-[var(--text-dim)]">
          THE FIGHT — DRIVERS&rsquo; CHAMPIONSHIP
        </p>
      </FadeUp>

      <div>
        {rows.map((row, i) => (
          <ClipReveal key={row.position} delay={i * 0.08}>
            <div className="flex items-baseline gap-5 border-t border-[var(--line)] py-2 md:gap-10">
              <span
                aria-label={`Position ${row.position}`}
                className="shrink-0 leading-[0.85]"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(8rem, 18vw, 16rem)',
                  color: row.position === 1 ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {row.position}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate uppercase leading-[0.95] text-[var(--text)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.6rem, 7vw, 7rem)',
                  }}
                  title={row.fullName}
                >
                  {row.surname}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-mono tabular-nums text-[var(--text)]" style={{ fontSize: 'clamp(1.4rem, 3vw, 2.6rem)' }}>
                  <CountUp value={row.points} />
                </span>
                <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
              </div>
            </div>
          </ClipReveal>
        ))}
      </div>

      <FadeUp className="mt-12">
        <TransitionLink
          href="/standings"
          className="label-mono inline-block text-[var(--text)] transition-colors hover:text-[var(--accent)]"
        >
          FULL STANDINGS →
        </TransitionLink>
      </FadeUp>
    </section>
  )
}
