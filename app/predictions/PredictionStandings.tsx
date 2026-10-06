'use client'

import { useState } from 'react'
import { predictionStandings, type PredictionSave } from '@/lib/predictions/game'

export default function PredictionStandings({ save, onName }: { save: PredictionSave; onName: () => void }) {
  const [mode, setMode] = useState<'season' | 'round'>('season')
  const rows = predictionStandings(save, mode)
  const played = save.entries.filter(e => e.revealed).length
  return <section className="predictions-standings">
    <div className="predictions-section-heading"><p className="predictions-label">The Predictions leaderboard</p><h2>LET THE CALLS TALK.</h2><p>Your own season of bragging rights. Fantasy points live in their own championship.</p></div>
    <div className="predictions-board-tools"><div><strong>{save.name}</strong><button onClick={onName}>Edit display name ↗</button></div><div className="predictions-toggle" aria-label="Leaderboard period"><button aria-pressed={mode === 'season'} onClick={() => setMode('season')}>Season</button><button aria-pressed={mode === 'round'} onClick={() => setMode('round')}>Latest weekend</button></div></div>
    <p className="predictions-board-note">Practice leaderboard / 15 computer opponents{played === 0 ? '. Complete a weekend to set the standings.' : ''}</p>
    <div className="predictions-table-scroll" data-scroll-x tabIndex={0} role="region" aria-label="Scrollable predictions leaderboard"><table><caption className="sr-only">{mode === 'season' ? 'Season' : 'Latest weekend'} prediction standings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Exact calls</th><th scope="col">Points</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={row.id === 'you' ? 'is-you' : ''}><td>{played ? String(row.rank).padStart(2, '0') : '-'}</td><th scope="row">{row.name}<small>{row.id === 'you' ? 'You' : 'Computer'}</small></th><td>{row.exact}<span> / {row.races * 6}</span></td><td>{row.points}</td></tr>)}</tbody></table></div>
  </section>
}
