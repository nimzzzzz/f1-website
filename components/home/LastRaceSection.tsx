'use client'

import { FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

export interface PodiumRow {
  position: number
  surname: string
  fullName: string
  gapLabel: string
}

export default function LastRaceSection({ raceLabel, podium }: { raceLabel: string | null; podium: PodiumRow[] | null }) {
  return <section className="last-race-section home-width" aria-labelledby="last-race-title">
    <FadeUp className="last-race-inner">
      <div className="last-race-heading"><span className="chequered-mark" aria-hidden="true" /><h2 id="last-race-title">Last time out<span>{raceLabel ?? 'Results pending'}</span></h2></div>
      <ol className="last-race-podium">{[1, 2, 3].map((position) => {
        const driver = podium?.find((p) => p.position === position)
        return <li key={position}><span className="last-race-position">{String(position).padStart(2, '0')}</span><div><h3>{driver?.surname ?? 'TBC'}</h3><span>{driver ? position === 1 ? 'RACE WINNER' : driver.gapLabel : 'AWAITING RESULTS'}</span></div></li>
      })}</ol>
      <TransitionLink href="/results" className="last-race-link" aria-label="View race results"><span aria-hidden="true">↗</span></TransitionLink>
    </FadeUp>
  </section>
}
