'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Meeting, Session } from '@/lib/openf1'
import HeroCanvas from '@/components/hero/HeroCanvas'

interface Props {
  meeting: Meeting
  raceSession: Session | null
  round: number
  totalRounds: number
  isLive: boolean
}

interface TimeLeft {
  days: number
  hours: number
  mins: number
  secs: number
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now())
  const total = Math.floor(diff / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

// Section 1 — "NOW". Full viewport, typographic. This is what the intro
// hands off to: same black mood, the race name at display scale where the
// video's wordmark just was.
export default function NowSection({ meeting, raceSession, round, totalRounds, isLive }: Props) {
  const target = raceSession ? new Date(raceSession.date_start) : new Date(meeting.date_start)
  const [left, setLeft] = useState<TimeLeft>(() => calcTimeLeft(target))
  // WebGL hero state: when the 3D scene is live, the type planes pick up
  // a slight cursor parallax (different coefficients per plane) so the
  // countdown and race name read as floating IN the scene's space.
  const [heroLive, setHeroLive] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const numeralRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isLive) return
    const id = setInterval(() => setLeft(calcTimeLeft(target)), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, target.getTime()])

  useEffect(() => {
    if (!heroLive) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cur = { x: 0, y: 0 }
    const tgt = { x: 0, y: 0 }
    const onMouse = (e: MouseEvent) => {
      tgt.x = e.clientX / window.innerWidth - 0.5
      tgt.y = e.clientY / window.innerHeight - 0.5
    }
    let raf = 0
    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.05
      cur.y += (tgt.y - cur.y) * 0.05
      // content drifts against the camera; the huge numeral barely moves —
      // three planes (numeral, circuit, type) at three depths
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${(-cur.x * 14).toFixed(2)}px, ${(-cur.y * 8).toFixed(2)}px, 0)`
      }
      if (numeralRef.current) {
        numeralRef.current.style.transform = `translate3d(${(cur.x * 5).toFixed(2)}px, ${(cur.y * 3).toFixed(2)}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMouse, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMouse)
      cancelAnimationFrame(raf)
      if (contentRef.current) contentRef.current.style.transform = ''
      if (numeralRef.current) numeralRef.current.style.transform = ''
    }
  }, [heroLive])

  const nameMatch = meeting.meeting_name.match(/^(.*?)\s+(Grand\s+Prix)$/i)
  const big = (nameMatch ? nameMatch[1] : meeting.meeting_name).toUpperCase()
  const suffix = nameMatch ? 'GRAND PRIX' : ''

  const dateRange = `${new Date(meeting.date_start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} — ${new Date(meeting.date_end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`.toUpperCase()

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden px-6 md:px-14">
      {/* WebGL circuit hero — absolute layer behind everything; renders
          nothing unless the capability gate passes (static NOW is the floor) */}
      <HeroCanvas circuitShortName={meeting.circuit_short_name} onLive={setHeroLive} />

      {/* oversized dim outline round numeral, asymmetric behind the composition */}
      <span
        ref={numeralRef}
        aria-hidden
        className="outline-numeral absolute -right-[4vw] top-[2%] leading-none"
        style={{ fontSize: 'clamp(16rem, 42vw, 52rem)' }}
      >
        {pad(round)}
      </span>

      <div ref={contentRef} className="relative">
        <p className="label-mono mb-6 flex items-center gap-3 text-[var(--text-dim)]">
          {isLive ? (
            <span className="flex items-center gap-2 text-[var(--accent)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              LIVE
            </span>
          ) : (
            <span>NOW</span>
          )}
          <span aria-hidden>—</span>
          <span>
            ROUND {pad(round)} / {pad(totalRounds)}
          </span>
        </p>

        <h1
          className="uppercase text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(6rem, 14vw, 15rem)',
            lineHeight: 0.82,
            letterSpacing: '0.01em',
          }}
        >
          {big}
        </h1>
        {suffix && (
          <p
            className="mt-2 uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3.4vw, 3.4rem)',
              lineHeight: 1,
              letterSpacing: '0.12em',
              color: 'var(--text-dim)',
            }}
          >
            {suffix}
          </p>
        )}

        <p className="label-mono mt-8 text-[var(--text-dim)]">
          {meeting.circuit_short_name.toUpperCase()} · {meeting.country_name.toUpperCase()} ·{' '}
          {dateRange}
        </p>

        {/* countdown — large mono digits */}
        {!isLive && (
          <div className="mt-12 flex items-end gap-4 md:gap-8" aria-label="Race countdown">
            {(
              [
                [left.days, 'DAYS'],
                [left.hours, 'HRS'],
                [left.mins, 'MIN'],
                [left.secs, 'SEC'],
              ] as const
            ).map(([value, label], i) => (
              <React.Fragment key={label}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="pb-6 font-mono text-[var(--text-dim)]"
                    style={{ fontSize: 'clamp(1.4rem, 3.5vw, 3rem)' }}
                  >
                    :
                  </span>
                )}
                <div>
                  <div
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(2.6rem, 7vw, 6rem)' }}
                  >
                    {pad(value)}
                  </div>
                  <div className="label-mono mt-2 text-[var(--text-dim)]">{label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
