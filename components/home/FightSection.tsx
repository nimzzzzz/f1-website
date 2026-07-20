'use client'

import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { driverImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'

export interface FightRow {
  position: number
  surname: string
  fullName: string
  points: number
  wins: number
  acronym?: string
}

// Shared row frame so the ghost and the real content occupy identical
// geometry — late data must replace in place, never resize the section.
function Row({
  numeral,
  ghost,
  name,
  points,
  acronym = null,
}: {
  numeral: number
  ghost: boolean
  name: string
  points: number | null
  acronym?: string | null
}) {
  return (
    <div className="flex items-baseline gap-5 border-t border-[var(--line)] py-2 md:gap-10">
      <span
        aria-hidden={ghost}
        aria-label={ghost ? undefined : `Position ${numeral}`}
        className="shrink-0 leading-[0.85]"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(8rem, 18vw, 16rem)',
          ...(ghost
            ? { color: 'transparent', WebkitTextStroke: '1px rgba(245,245,243,0.07)' }
            : numeral === 1
            ? { color: 'var(--accent)' }
            : { color: 'var(--text)' }),
        }}
      >
        {numeral}
      </span>
      {/* headshot chip — same fixed box in ghost and live rows, so the
          swap never moves the layout; face crop via cover-from-top. Eager so
          the three chips download while the intro is still on screen (free
          loading time), rather than popping in when the section reveals. */}
      <TreatedImage
        src={acronym ? driverImage(acronym) : null}
        alt=""
        treatment="mono"
        fit="cover"
        position="top"
        fade={false}
        eager
        sizes="96px"
        className="hidden h-16 w-16 shrink-0 self-end sm:block md:h-24 md:w-24"
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate uppercase leading-[0.95]"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.6rem, 7vw, 7rem)',
            color: ghost ? 'rgba(245,245,243,0.08)' : 'var(--text)',
          }}
          title={ghost ? undefined : name}
        >
          {ghost ? '———' : name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: 'clamp(1.4rem, 3vw, 2.6rem)',
            color: ghost ? 'rgba(245,245,243,0.15)' : 'var(--text)',
          }}
        >
          {ghost || points === null ? '—' : <CountUp value={points} />}
        </span>
        <span
          className="label-mono ml-2"
          style={{ color: ghost ? 'rgba(245,245,243,0.15)' : 'var(--text-dim)' }}
        >
          PTS
        </span>
      </div>
    </div>
  )
}

// Section 2 — "THE FIGHT". The frame renders immediately — ghost numerals
// at full scale hold the layout — and real rows replace it in place when
// the standings math lands.
export default function FightSection({ rows }: { rows: FightRow[] | null }) {
  return (
    <section className="border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
      <FadeUp>
        <p className="section-header mb-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--text-dim)]">
          THE FIGHT — DRIVERS&rsquo; CHAMPIONSHIP
          
        </p>
      </FadeUp>

      {/* keyed so arriving data remounts the reveals, in place */}
      <div key={rows ? 'live' : 'ghost'}>
        {rows
          ? rows.map((row, i) => (
              <ClipReveal key={row.position} delay={i * 0.08}>
                <Row
                  numeral={row.position}
                  ghost={false}
                  name={row.surname}
                  points={row.points}
                  acronym={row.acronym ?? null}
                />
              </ClipReveal>
            ))
          : [1, 2, 3].map((n) => (
              <Row key={`ghost-${n}`} numeral={n} ghost name="———" points={null} />
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
