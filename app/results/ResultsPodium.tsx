'use client'

import { useRef, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { driverImage } from '@/lib/media-manifest'
import { circuitPhoto } from '@/lib/circuit-photos-manifest'
import { formatSessionTime, sessionGap, timingValue, teamColor, type ResultRow, type SessionKind } from '@/lib/results-story'
import type { Session } from '@/lib/openf1'

export function DriverPortrait({ row, hero = false }: { row: ResultRow; hero?: boolean }) {
  const src = driverImage(row.driver.name_acronym)
  return src ? <Image src={src} alt="" fill sizes={hero ? '(max-width: 640px) 55vw, 38vw' : '64px'}
    loading={hero ? 'eager' : 'lazy'} fetchPriority={hero && row.position === 1 ? 'high' : 'auto'}
    className="results-driver-image" /> : <span className="results-portrait-fallback" aria-hidden>{row.driver.driver_number}</span>
}

export default function ResultsPodium({ rows, session, kind, published }: {
  rows: ResultRow[]; session: Session; kind: SessionKind; published: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const winner = rows.find((r) => r.position === 1 && !r.detail?.dsq)
  const top = [1, 2, 3].map((p) => rows.find((r) => r.position === p && !r.detail?.dsq)).filter((r): r is ResultRow => !!r)
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.results-podium-portrait', { clipPath: 'inset(0 100% 0 0)', x: -18 },
        { clipPath: 'inset(0 0% 0 0)', x: 0, duration: 1.15, stagger: .12, ease: 'power3.out', clearProps: 'transform,clipPath' })
      gsap.fromTo('.results-finish-rule', { scaleX: 0 }, { scaleX: 1, duration: .8, ease: 'power3.inOut', clearProps: 'transform' })
      gsap.fromTo('.results-podium-copy', { y: 16 }, { y: 0, duration: .9, stagger: .1, ease: 'power3.out', clearProps: 'transform' })
    })
    return () => mm.revert()
  }, { scope: ref })
  if (!winner) return null
  const photo = circuitPhoto(session.circuit_short_name)
  const title = !published ? 'SESSION LEADER' : kind === 'qualifying' ? 'POLE POSITION' : kind === 'practice' ? 'SETTING THE PACE' : 'THE PODIUM'
  const shown = kind === 'practice' ? [winner] : top
  const time = timingValue(winner.detail?.duration ?? null)

  return (
    <section ref={ref} className={`results-podium results-podium--${kind}`} aria-label={title}>
      {photo && <Image className="results-podium-circuit" src={photo} alt="" fill sizes="100vw" quality={45} loading="eager" />}
      <div className="results-podium-shade" aria-hidden />
      <div className="results-finish-rule" aria-hidden />
      <div className="results-podium-heading">
        <h2>{title}</h2>
        <span className="results-caption">{published ? 'SESSION CLASSIFICATION' : 'LATEST TIMING ORDER'}</span>
      </div>
      <div className="results-podium-stage">
        {shown.map((row) => (
          <article key={row.driver_number} className={`results-podium-driver results-podium-p${row.position}`}
            style={{ '--driver-color': teamColor(row.driver) } as CSSProperties}>
            <div className="results-podium-portrait">
              <span className="results-podium-place" aria-hidden>{String(row.position).padStart(2, '0')}</span>
              <DriverPortrait row={row} hero />
            </div>
            <div className="results-podium-copy">
              <p className="results-caption"><span className="results-team-mark" aria-hidden /> P{row.position} <span>{row.driver.first_name}</span></p>
              <h3>{row.driver.name_acronym ? <Link href={`/drivers/${row.driver.name_acronym.toLowerCase()}`} prefetch={false}>{row.driver.last_name}</Link> : row.driver.full_name}</h3>
              <p className="results-podium-team">{row.driver.team_name}</p>
              <p className="results-podium-time">{row.position === 1 ? formatSessionTime(time) : sessionGap(row.detail, kind)}</p>
            </div>
          </article>
        ))}
        {kind === 'practice' && <div className="results-practice-stat">
          <span className="results-caption">LAPS COMPLETED</span>
          <strong>{winner.detail?.number_of_laps ?? '—'}</strong>
          <p>{session.session_name}.<br />Fastest lap of the session.</p>
        </div>}
      </div>
      {kind === 'qualifying' && Array.isArray(winner.detail?.duration) && (
        <div className="results-pole-laps" aria-label={`${winner.driver.full_name} qualifying times`}>
          {winner.detail.duration.slice(0, 3).map((lap, i) => <div key={i}><span className="results-caption">{session.session_name.includes('Sprint') ? 'SQ' : 'Q'}{i + 1}</span><strong>{formatSessionTime(lap)}</strong></div>)}
        </div>
      )}
    </section>
  )
}
