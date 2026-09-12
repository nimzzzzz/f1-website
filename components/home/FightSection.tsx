'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import { FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { driverImage } from '@/lib/media-manifest'

export interface FightRow {
  position: number
  surname: string
  fullName: string
  points: number
  wins: number
  acronym?: string
  teamName?: string
  teamColour?: string
}

export default function FightSection({ rows, computedAt }: { rows: FightRow[] | null; computedAt?: string | null }) {
  return (
    <section className="fight-section home-width" aria-labelledby="fight-title">
      <FadeUp>
        <div className="home-section-heading"><h2 id="fight-title">The fight<span>.</span></h2><TransitionLink href="/standings" className="race-text-link">Full standings <span aria-hidden="true">↗</span></TransitionLink></div>
        <p className="home-section-description">Every point. Every position. Everything to play for.</p>
      </FadeUp>
      <div className="fight-grid">
        {(rows ?? [null, null, null]).map((row, i) => {
          const src = row?.acronym ? driverImage(row.acronym) : null
          return <FadeUp key={row?.acronym ?? i} delay={i * 0.09} className={`fight-driver ${i === 0 ? 'fight-leader' : ''}`} style={{ '--team-color': row?.teamColour ? `#${row.teamColour.replace('#', '')}` : '#e10600' } as CSSProperties}>
            <TransitionLink href={row?.acronym ? `/drivers/${row.acronym.toLowerCase()}` : '/standings'} className="fight-driver-link" aria-label={row ? `${row.fullName}, position ${row.position}, ${row.points} points. View driver.` : 'View standings'}>
              <div className="fight-portrait">
                <span className="fight-position" aria-hidden="true">{String(row?.position ?? i + 1).padStart(2, '0')}</span>
                {src && <Image src={src} alt="" fill sizes={i === 0 ? '(max-width: 767px) 100vw, 45vw' : '(max-width: 767px) 50vw, 27vw'} />}
                <span className="fight-tag">{i === 0 ? 'CHAMPIONSHIP LEADER' : row && rows?.[0] ? `${rows[0].points - row.points} PTS TO LEADER` : 'DRIVERS’ CHAMPIONSHIP'}</span>
                <span className="fight-driver-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="fight-driver-info"><div><span className="fight-team">{row?.teamName ?? 'Awaiting standings'}</span><h3>{row?.surname ?? 'TBC'}</h3></div><div className="fight-points"><strong>{row?.points ?? '-'}</strong><span>PTS</span></div></div>
            </TransitionLink>
          </FadeUp>
        })}
      </div>
      <div className="fight-footnote"><span>Drivers’ championship</span>{computedAt && <span>Standings as of {new Date(computedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}</span>}</div>
    </section>
  )
}
