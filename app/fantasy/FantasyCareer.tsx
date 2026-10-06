'use client'

import { useState } from 'react'
import { fantasyCareer, raceDuel } from '@/lib/fantasy/career'
import { PRACTICE_DRIVERS } from '@/lib/fantasy/practice'
import { ROLE_INFO } from '@/lib/fantasy/rules'
import { ROLES, type PracticeSave } from '@/lib/fantasy/types'
import { DriverPortrait } from './DriverMarket'

export function DuelBreakdown({ save, round }: { save: PracticeSave; round: number }) {
  const duel = raceDuel(save, round)
  if (!duel) return null
  return <section className={`fantasy-battle is-${duel.verdict}`} aria-label="Head-to-head scoring breakdown">
    <div className="fantasy-battle-heading"><span className="fantasy-kicker">{duel.consolation ? 'Consolation battle' : duel.cupFinal ? 'The cup final' : 'The head-to-head'}</span><h3>WHERE IT WAS WON.</h3><p>{duel.tiebreak ? 'Equal points. The published cup tiebreak decided the winner.' : duel.difference === 0 ? 'Level on points. This consolation match is a draw.' : `${Math.abs(duel.difference)} points separated the teams.`}</p></div>
    <div className="fantasy-battle-score"><div><span>{save.team.name}</span><strong>{duel.you.total}</strong></div><span>VS</span><div><span>{duel.opponent.name}<small>Computer opponent</small></span><strong>{duel.opponentScore.total}</strong></div></div>
    <div className="fantasy-battle-roles">{ROLES.map((role, i) => {
      const left = duel.you.drivers[i], right = duel.opponentScore.drivers[i]
      const a = PRACTICE_DRIVERS.find(d => d.id === left.driverId)!, b = PRACTICE_DRIVERS.find(d => d.id === right.driverId)!
      const delta = left.total - right.total
      return <div className="fantasy-battle-role" key={role}><div><DriverPortrait driver={a} /><span><strong>{a.surname}</strong><small>{left.base} base + {left.bonus} role</small></span><b>{left.total}</b></div><div className="fantasy-battle-role-label"><span>{ROLE_INFO[role].name}</span><strong>{delta === 0 ? 'EVEN' : `${delta > 0 ? '+' : ''}${delta}`}</strong><small>{delta === 0 ? 'Same contribution' : delta > 0 ? 'Your advantage' : 'Their advantage'}</small></div><div><b>{right.total}</b><span><strong>{b.surname}</strong><small>{right.base} base + {right.bonus} role</small></span><DriverPortrait driver={b} /></div></div>
    })}</div>
  </section>
}

export default function FantasyCareer({ save, onReview }: { save: PracticeSave; onReview: (round: number) => void }) {
  const career = fantasyCareer(save)
  const [selected, setSelected] = useState<number | null>(null)
  const focus = career.history.find(r => r.round === selected) ?? career.history.at(-1)
  const x = (round: number) => 30 + (round - 1) / 23 * 930
  const y = (rank: number) => 24 + (rank - 1) / 15 * 168
  return <section className="fantasy-career">
    <div className="fantasy-section-intro"><span className="fantasy-kicker">Your constructor story</span><h2>A SEASON WITH YOUR NAME ON IT.</h2><p>Every climb. Every close call. Every trophy earned.</p></div>
    <div className="fantasy-career-record"><div><span>Head-to-head wins</span><strong>{career.wins}<small> / {career.history.length}</small></strong></div><div><span>Best weekend</span><strong>{career.best?.points ?? 0}<small> pts</small></strong></div><div><span>Longest winning run</span><strong>{career.longestWinStreak}<small> races</small></strong></div></div>
    <div className="fantasy-trajectory"><div><h3>THE CHAMPIONSHIP TRAIL.</h3><p>{focus ? `After race ${focus.round}: P${focus.rank}, ${focus.total} points.` : 'Run your first practice race to put a mark on the season.'}</p></div>
      <svg viewBox="0 0 990 222" role="img" aria-label={career.history.length ? `Championship position by race: ${career.history.map(r => `race ${r.round}, P${r.rank}`).join('; ')}` : 'Empty championship position chart'}>
        {[1, 8, 16].map(rank => <g key={rank}><line x1="30" x2="960" y1={y(rank)} y2={y(rank)} stroke="#36363a" strokeDasharray="3 6" /><text x="0" y={y(rank) + 4} fill="#b4b4bc" fontSize="11">{rank}</text></g>)}
        {career.history.length > 0 && <><polyline fill="none" stroke="var(--fantasy-accent)" strokeWidth="3" points={career.history.map(r => `${x(r.round)},${y(r.rank)}`).join(' ')} />{career.history.map(r => <circle key={r.round} cx={x(r.round)} cy={y(r.rank)} r={focus?.round === r.round ? 6 : 3} fill={focus?.round === r.round ? '#fff' : 'var(--fantasy-accent)'} />)}</>}
        <text x="30" y="217" fill="#b4b4bc" fontSize="10">RACE 01</text><text x="960" y="217" fill="#b4b4bc" fontSize="10" textAnchor="end">RACE 24</text>
      </svg>
      <div className="fantasy-race-selector" role="group" aria-label="Explore completed races">{career.history.map(r => <button key={r.round} aria-pressed={focus?.round === r.round} onClick={() => setSelected(r.round)} aria-label={`Race ${r.round}: P${r.rank}, ${r.points} points`}>{String(r.round).padStart(2, '0')}</button>)}</div>
      {focus && <div className="fantasy-race-recap"><div><span>Race {String(focus.round).padStart(2, '0')}</span><strong>{focus.points}<small>PTS</small></strong></div><p>{focus.movement > 0 ? `Up ${focus.movement} ${focus.movement === 1 ? 'place' : 'places'}.` : focus.movement < 0 ? `Down ${Math.abs(focus.movement)} ${focus.movement === -1 ? 'place' : 'places'}.` : focus.round === 1 ? 'Your opening position is set.' : 'Championship position held.'} {focus.bonus} points came from role bonuses.</p><button className="fantasy-text-button" onClick={() => onReview(focus.round)}>Open race debrief ↗</button></div>}
    </div>
    <section className="fantasy-trophy-room"><div><span className="fantasy-kicker">The trophy cabinet</span><h3>EARNED. NEVER GIVEN.</h3><p>Milestones recognise your decisions. They do not add championship points.</p></div>
      <div className="fantasy-cup-shelf">{Array.from({ length: 6 }, (_, i) => { const trophy = career.trophies.find(t => t.number === i + 1); const completed = save.entries.length >= (i + 1) * 4; return <div key={i} className={trophy ? 'is-earned' : ''}><span className="fantasy-cup-art" aria-hidden><i /><b>{String(i + 1).padStart(2, '0')}</b></span><strong>Cup {i + 1}</strong><small>{trophy ? `Won in race ${trophy.round}` : completed ? 'Cup completed' : 'Still to be decided'}</small></div> })}</div>
      <div className="fantasy-achievements">{career.achievements.map((a, i) => <article key={a.id} className={a.round ? 'is-earned' : ''}><span aria-hidden>{String(i + 1).padStart(2, '0')}</span><div><h4>{a.name}</h4><p>{a.description}</p><small>{a.round ? `Earned in race ${a.round}` : 'Not earned yet'}</small></div></article>)}</div>
    </section>
  </section>
}
