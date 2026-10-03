'use client'

import { useState, type CSSProperties } from 'react'
import { buildCup, competitors, currentCupNumber, standings } from '@/lib/fantasy/practice'
import { SEASON_ROUNDS } from '@/lib/fantasy/rules'
import type { CupMatch, PracticeSave } from '@/lib/fantasy/types'

export function TeamMark({ name, colour, small = false }: { name: string; colour: string; small?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'LO'
  return <span className={`fantasy-team-mark${small ? ' fantasy-team-mark--small' : ''}`} style={{ '--team-ink': colour } as CSSProperties} aria-hidden>{initials}</span>
}

export function Championship({ save }: { save: PracticeSave }) {
  const [scope, setScope] = useState<'season' | 'round'>('season')
  const table = standings(save)
  const previous = standings(save, Math.max(0, save.entries.length - 1))
  const rows = scope === 'season' ? table : [...table].sort((a, b) => b.last - a.last || a.id.localeCompare(b.id))
  const you = table.find(t => t.id === 'you')!
  return <section className="fantasy-competition" aria-labelledby="fantasy-championship-title">
    <div className="fantasy-section-intro"><span className="fantasy-kicker">The long game</span><h2 id="fantasy-championship-title">EVERY RACE COUNTS.</h2><p>Your season continues, whatever happens in the cup.</p></div>
    <div className="fantasy-championship-summary"><div><span>Your position</span><strong>{save.entries.length ? String(you.rank).padStart(2, '0') : 'TBD'}<small> / 16</small></strong></div><div><span>Championship points</span><strong>{you.total}</strong></div><div><span>Races completed</span><strong>{save.entries.length}<small> / {SEASON_ROUNDS}</small></strong></div></div>
    <div className="fantasy-table-toolbar"><p>Practice championship <span>15 computer opponents</span></p><div className="fantasy-toggle" aria-label="Leaderboard scoring"><button aria-pressed={scope === 'season'} onClick={() => setScope('season')}>Full season</button><button aria-pressed={scope === 'round'} onClick={() => setScope('round')}>Latest race</button></div></div>
    {!save.entries.length && <p className="fantasy-notice">The grid is ready. Run your first practice race to set the standings.</p>}
    <div className="fantasy-table-scroll" data-lenis-prevent><table className="fantasy-table"><caption className="sr-only">{scope === 'season' ? 'Season' : 'Latest race'} practice leaderboard</caption><thead><tr><th scope="col">Pos</th><th scope="col">Team</th><th scope="col">Movement</th><th scope="col">{scope === 'season' ? 'Last race' : 'Season pts'}</th><th scope="col">{scope === 'season' ? 'Season pts' : 'Race pts'}</th></tr></thead><tbody>
      {rows.map(row => {
        const rank = scope === 'season' ? row.rank : rows.findIndex(r => r.last === row.last) + 1
        const move = (previous.find(t => t.id === row.id)?.rank ?? row.rank) - row.rank
        return <tr key={row.id} className={row.id === 'you' ? 'is-you' : undefined}><td>{save.entries.length ? String(rank).padStart(2, '0') : '-'}</td><th scope="row"><div className="fantasy-table-team"><TeamMark name={row.name} colour={row.colour} small /><span>{row.name}<small>{row.computer ? 'Computer' : 'Your team'}</small></span></div></th><td>{scope === 'round' || save.entries.length < 2 || move === 0 ? '-' : <span aria-label={`${Math.abs(move)} ${Math.abs(move) === 1 ? 'place' : 'places'} ${move > 0 ? 'up' : 'down'}`}>{move > 0 ? '↑' : '↓'} {Math.abs(move)}</span>}</td><td>{save.entries.length ? scope === 'season' ? row.last : row.total : '-'}</td><td>{scope === 'season' ? row.total : row.last}</td></tr>
      })}
    </tbody></table></div>
  </section>
}

export function Knockout({ save }: { save: PracticeSave }) {
  const current = currentCupNumber(save.entries.length)
  const [selection, setSelection] = useState<number | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)
  const number = selection ?? current
  const cup = buildCup(save, number)
  const teams = competitors(save)
  const team = (id: string | null) => teams.find(t => t.id === id)
  const names = ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final']
  const match = cup.stages.flat().find(m => m.id === selectedMatch)
  const champion = team(cup.champion)
  const title = (m: CupMatch) => `${team(m.a)?.name ?? 'To be decided'} versus ${team(m.b)?.name ?? 'To be decided'}`
  return <section className="fantasy-competition" aria-labelledby="fantasy-cup-title">
    <div className="fantasy-section-intro"><span className="fantasy-kicker">The knockout cup</span><h2 id="fantasy-cup-title">FOUR RACES. ONE WINNER.</h2><p>Advance each weekend. Lift the trophy. Do it all again.</p></div>
    <div className="fantasy-cup-toolbar"><div className="fantasy-cup-identity"><span className="fantasy-cup-number">{String(number).padStart(2, '0')}</span><div><h3>{champion ? `${champion.name} wins` : 'THE ROAD TO THE FINAL'}</h3><p>Practice races {(number - 1) * 4 + 1} to {number * 4}</p></div></div><label>Cup <select value={number} onChange={e => { setSelection(Number(e.target.value)); setSelectedMatch(null) }}>{Array.from({ length: current }, (_, i) => <option value={i + 1} key={i}>Cup {i + 1}{i + 1 === current ? ' (current)' : ''}</option>)}</select></label></div>
    <p className="fantasy-bracket-hint">Select a matchup for details. On smaller screens, swipe across the bracket.</p>
    <div className="fantasy-bracket-scroll" tabIndex={0} role="region" aria-label={`Cup ${number} tournament bracket`} data-lenis-prevent>
      <div className="fantasy-bracket">
        {cup.stages.map((matches, i) => <div className={`fantasy-bracket-stage fantasy-bracket-stage--${i}`} key={names[i]}><h3>{names[i]}<small>Race {(number - 1) * 4 + i + 1}</small></h3><div className="fantasy-bracket-matches">{matches.map(m => <button key={m.id} aria-label={title(m)} aria-pressed={selectedMatch === m.id} className={`fantasy-match${m.a === 'you' || m.b === 'you' ? ' fantasy-match--you' : ''}`} onClick={() => setSelectedMatch(m.id)}>
          {[m.a, m.b].map((id, j) => <span className={`fantasy-match-team${id && m.winner === id ? ' is-winner' : ''}`} key={j}><span>{id === 'you' && <b>You </b>}{team(id)?.name ?? 'Awaiting winner'}</span><strong>{(j === 0 ? m.scoreA : m.scoreB)?.total ?? '-'}</strong></span>)}
          {m.tiebreak && <small className="fantasy-tiebreak">Decided on tiebreak</small>}
        </button>)}</div></div>)}
      </div>
    </div>
    {match && <div className="fantasy-match-detail" aria-live="polite"><h3>{title(match)}</h3><p>{match.winner ? `${team(match.winner)?.name} ${match.round % 4 === 0 ? 'wins the cup' : 'advances'}${match.tiebreak ? ' on tiebreak' : ''}.` : `Race ${match.round} will decide this matchup.`}</p>{match.scoreA && match.scoreB && <p>Role bonuses: {match.scoreA.bonus} / {match.scoreB.bonus}. Team leader: {match.scoreA.leader} / {match.scoreB.leader}.</p>}{match.tiebreak && <p>Ties use role bonuses, then Team leader points, then the higher cup seed.</p>}</div>}
    <div className="fantasy-cup-note"><strong>Out of this cup? Your season is still on.</strong><p>Keep earning championship points, play consolation matchups and enter the next cup automatically.</p></div>
  </section>
}
