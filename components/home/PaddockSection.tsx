'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { carImageHi } from '@/lib/media-manifest'
import { teamToSlug } from '@/lib/team-data'
import type { BundleTeamStanding } from '@/lib/season-data'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { FadeUp } from '@/components/motion/reveals'

export default function PaddockSection({ teams }: { teams: BundleTeamStanding[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (!teams.length) return null
  const team = teams.find((t) => t.teamName === selected) ?? teams[0]
  const slug = teamToSlug(team.teamName)
  const image = carImageHi(slug)

  return <section className="paddock-section" aria-labelledby="paddock-title" style={{ '--team-color': `#${team.teamColour.replace('#', '')}` } as CSSProperties}>
    <div className="home-width">
      <FadeUp><div className="home-section-heading"><h2 id="paddock-title">Meet the machines<span>.</span></h2><TransitionLink href="/teams" className="race-text-link">All teams <span aria-hidden="true">↗</span></TransitionLink></div><p className="home-section-description">Different colours. The same obsession.</p></FadeUp>
      <div className="paddock-selector" role="group" aria-label="Choose a constructor">
        {teams.map((t) => <button type="button" key={t.teamName} aria-pressed={t.teamName === team.teamName} onClick={() => setSelected(t.teamName)} style={{ '--swatch': `#${t.teamColour.replace('#', '')}` } as CSSProperties}><span aria-hidden="true" />{t.teamName.replace(' F1 Team', '').replace(' Racing', '')}</button>)}
      </div>
      <div className="paddock-machine" key={slug}>
        <span className="paddock-wordmark" aria-hidden="true">{team.teamName.replace(' F1 Team', '').replace(' Racing', '')}</span>
        {image && <Image src={image} alt={`${team.teamName} Formula 1 car, side profile`} width={1680} height={480} sizes="(max-width: 767px) 100vw, 85vw" className="paddock-car" />}
        <div className="paddock-ground" aria-hidden="true" />
      </div>
      <div className="paddock-details" aria-live="polite" aria-atomic="true">
        <div className="paddock-team-name"><span>CONSTRUCTOR</span><h3>{team.teamName}</h3></div>
        <dl><div><dt>POSITION</dt><dd>P{team.position}</dd></div><div><dt>POINTS</dt><dd>{team.points}</dd></div><div><dt>WINS</dt><dd>{team.wins}</dd></div></dl>
        <TransitionLink href={`/teams/${slug}`} className="race-button race-button-outline">Explore team <span aria-hidden="true">↗</span></TransitionLink>
      </div>
    </div>
  </section>
}
