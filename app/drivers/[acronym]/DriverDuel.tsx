'use client'

import Link from 'next/link'
import TreatedImage from '@/components/media/TreatedImage'
import { driverImage } from '@/lib/media-manifest'
import type { DriverSeasonView, SeasonStation } from '@/lib/season-view'

export default function DriverDuel({ view, selected, onSelect }: {
  view: DriverSeasonView
  selected: SeasonStation | null
  onSelect: (meetingKey: number) => void
}) {
  const { driver: d, duel } = view
  if (!duel) return null
  const selectedRound = duel.rounds.find((r) => r.meetingKey === selected?.meetingKey)
  const total = duel.myPoints + duel.theirPoints
  const share = total ? duel.myPoints / total * 100 : 50
  return (
    <section className="driver-duel" aria-labelledby="driver-duel-heading" id="driver-comparison" tabIndex={-1}>
      <div className="driver-section-heading">
        <div><p className="driver-eyebrow">02 / THE OTHER SIDE OF THE GARAGE</p><h2 id="driver-duel-heading">THE CLOSEST<br /><span>COMPARISON.</span></h2></div>
        <p className="driver-section-note">{d.teamName}<br />{duel.rounds.length} rounds both entered</p>
      </div>
      <div className="driver-duel-arena">
        <div className="driver-duel-photo driver-duel-photo-mine" aria-hidden="true"><TreatedImage src={driverImage(d.acronym)} treatment="mono" fit="cover" position="top" sizes="(min-width: 768px) 32vw, 50vw" className="absolute inset-0" /></div>
        <div className="driver-duel-photo driver-duel-photo-theirs" aria-hidden="true"><TreatedImage src={driverImage(duel.acronym)} treatment="mono" fit="cover" position="top" sizes="(min-width: 768px) 32vw, 50vw" className="absolute inset-0" /></div>
        <div className="driver-duel-score">
          <p className="driver-eyebrow">FINISHED AHEAD</p>
          <div><strong>{duel.raceWins}</strong><span>:</span><strong>{duel.raceLosses}</strong></div>
          <p className="driver-duel-classified">{duel.bothClassified} rounds both classified</p>
        </div>
        <div className="driver-duel-names"><span>{d.surname}</span><Link href={`/drivers/${duel.acronym.toLowerCase()}`}>{duel.surname}<span className="driver-duel-link-arrow"> ↗</span></Link></div>
      </div>
      <div className="driver-duel-points"><span><strong>{duel.myPoints}</strong> GP PTS</span><span>SHARED ROUNDS</span><span><strong>{duel.theirPoints}</strong> GP PTS</span></div>
      <div className="driver-duel-balance" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
      <div className="driver-duel-rounds" aria-label="Compare race results">
        {duel.rounds.map((round) => <button type="button" key={round.meetingKey} data-winner={round.winner}
          aria-pressed={round.meetingKey === selected?.meetingKey}
          title={`${round.circuit}: ${d.acronym} ${round.mine} / ${duel.acronym} ${round.theirs}`}
          onClick={() => onSelect(round.meetingKey)}><span>{String(round.round).padStart(2, '0')}{' '}</span><small>{round.winner === 'driver' ? d.acronym : round.winner === 'teammate' ? duel.acronym : '—'}</small><span className="sr-only">. {round.circuit}: {d.surname} {round.mine}, {duel.surname} {round.theirs}</span></button>)}
      </div>
      <div className="driver-duel-selected" role="status">
        <span>{selected?.circuit ?? 'NO RACE SELECTED'}</span>
        {selectedRound ? <span>{d.acronym} <b>{selectedRound.mine}</b><i>/</i>{duel.acronym} <b>{selectedRound.theirs}</b></span>
          : <span>No shared result for this round</span>}
      </div>
      <p className="driver-data-note">Current team pairing. GP points from rounds both entered; earlier team changes may be included. The score counts only rounds both classified.</p>
    </section>
  )
}
