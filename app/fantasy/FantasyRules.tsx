import { ROLE_INFO } from '@/lib/fantasy/rules'
import { ROLES } from '@/lib/fantasy/types'
import FantasyDialog from './FantasyDialog'

export default function FantasyRules({ onClose }: { onClose: () => void }) {
  return <FantasyDialog title="The team principal's handbook" onClose={onClose}>
    <p className="fantasy-dialog-copy">One squad. Every point counts towards your season and your current matchup.</p>
    <div className="fantasy-rules">
      <section><h3>Build your squad</h3><p>Three different drivers. A $60.0m budget. One role each. Prices stay fixed in practice. Save changes before running the next race; completed rounds keep their original lineup.</p></section>
      <section><h3>Everyone earns base points</h3><p>Qualifying P1 to P10 earns 10 down to 1 point. Race P1 to P10 earns 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 points. Finishing adds 2. A retirement costs 5 points; DNS adds no race points. Disqualification replaces all points with -10.</p></section>
      <section><h3>Make the role count</h3>{ROLES.map(role => <p key={role}><strong>{ROLE_INFO[role].name}: </strong>{ROLE_INFO[role].rule}</p>)}<p>Missing grid positions earn no Charger bonus. Teammate comparisons require one identifiable teammate and valid results. Beating a retired teammate counts; a non-starting or disqualified teammate does not.</p></section>
      <section><h3>The season championship</h3><p>All 24 practice rounds count, even after cup elimination. Equal total points share a championship rank. Cup wins earn trophies, with no extra championship points.</p></section>
      <section><h3>The knockout cups</h3><p>16 teams. Four races. One winner. Win your matchup to advance. After each final, all teams enter a new cup. The first draw is fixed; subsequent cups are seeded by the standings before the cup begins. Eliminated teams get consolation matchups.</p><p>Ties are decided by role bonus points, then Team leader points, then the higher cup seed. The bracket stays fixed for all four races.</p></section>
      <section><h3>Practice before lights out</h3><p>This is a local practice season with 15 computer opponents, a sample driver roster and simulated results. Your team is saved in this browser only. Accounts, real race deadlines and shared leagues are not connected yet. Sprint scoring is outside this first ruleset.</p></section>
    </div>
  </FantasyDialog>
}
