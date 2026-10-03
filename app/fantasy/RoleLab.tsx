'use client'

import { useState } from 'react'
import { compareRoles, ROLE_INFO } from '@/lib/fantasy/rules'
import { ROLES, type DriverResult, type Lineup } from '@/lib/fantasy/types'

export default function RoleLab({ lineup, results }: { lineup: Lineup; results: DriverResult[] }) {
  const options = compareRoles(lineup, results)
  const recorded = options.find(option => option.actual)!
  const [selected, setSelected] = useState(recorded.key)
  const choice = options.find(option => option.key === selected) ?? recorded
  const gained = options[0].difference
  return <section className="fantasy-role-lab" aria-labelledby="fantasy-role-lab-title">
    <div className="fantasy-role-lab-heading"><div><span className="fantasy-kicker">The decision room</span><h3 id="fantasy-role-lab-title">SAME DRIVERS. SIX POSSIBILITIES.</h3></div><div><strong>{gained ? `+${gained}` : 'OPTIMAL'}</strong><span>{gained ? 'points available in hindsight' : 'Your roles earned the highest score'}</span></div></div>
    <p>See what a different role assignment would have earned in this race. Your recorded score stays at {recorded.score.total} points.</p>
    <div className="fantasy-role-options" role="group" aria-label="Compare six role assignments">{options.map(option => <button key={option.key} aria-pressed={choice.key === option.key} onClick={() => setSelected(option.key)} aria-label={`Leader ${option.lineup.leader}, charger ${option.lineup.charger}, rival ${option.lineup.rival}: ${option.score.total} points${option.actual ? ', your lineup' : ''}`}>
      <span className="fantasy-role-option-label">{option.actual ? 'Your lineup' : option.score.total === options[0].score.total ? 'Best in hindsight' : 'Alternative'}</span>
      <span className="fantasy-role-option-drivers">{ROLES.map(role => <span key={role}><small>{ROLE_INFO[role].short}</small><strong>{option.lineup[role]}</strong></span>)}</span>
      <span className="fantasy-role-option-score"><strong>{option.score.total}<small>PTS</small></strong><span>{option.difference > 0 ? '+' : ''}{option.difference} vs yours</span></span>
    </button>)}</div>
    <div className="fantasy-role-explanation" aria-live="polite"><strong>{choice.actual ? 'Your role bonuses' : 'Alternative role bonuses'} <span>+{choice.score.bonus} pts</span></strong><div>{choice.score.drivers.map(driver => <p key={driver.role}><span>{driver.driverId} / {ROLE_INFO[driver.role].name}</span><strong>+{driver.bonus}</strong></p>)}</div><p>Base points stay the same. Only the role bonuses change. This is a post-race comparison, not a prediction of the next weekend.</p></div>
  </section>
}
