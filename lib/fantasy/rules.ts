import type { DriverResult, FantasyDriver, FantasyTeam, Lineup, Role, SquadScore } from './types'
import { ROLES } from './types'

export const BUDGET = 600
export const SEASON_ROUNDS = 24
export const CUP_ROUNDS = 4
export const COLOURS = [
  { name: 'Racing red', value: '#ff6259' }, { name: 'Papaya', value: '#ffae62' },
  { name: 'Mint', value: '#63dfbd' }, { name: 'Ice blue', value: '#85bdff' },
  { name: 'Silver', value: '#c6ccd4' },
] as const
export const ROLE_INFO: Record<Role, { name: string; short: string; description: string; rule: string }> = {
  leader: { name: 'Team leader', short: 'LEAD', description: 'The front of the fight.', rule: 'Double qualifying and race position points.' },
  charger: { name: 'Charger', short: 'CHRG', description: 'Make every position count.', rule: '+2 per position gained. Maximum +20; must finish.' },
  rival: { name: 'Teammate rival', short: 'RIVL', description: 'Win the battle within.', rule: '+5 for outqualifying their teammate. +8 for beating them in the race.' },
}
export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const
export const money = (tenths: number) => `$${(tenths / 10).toFixed(1)}m`
export function lineupCost(lineup: Lineup, drivers: readonly FantasyDriver[]): number {
  return ROLES.reduce((sum, role) => sum + (drivers.find(d => d.id === lineup[role])?.price ?? 0), 0)
}
export function validateTeam(team: FantasyTeam, drivers: readonly FantasyDriver[]): string | null {
  if (typeof team.name !== 'string' || team.name.trim().length < 2 || team.name.trim().length > 28) return 'Give your team a name between 2 and 28 characters.'
  if (!COLOURS.some(c => c.value === team.colour)) return 'Choose one of the team colours.'
  if (!team.lineup || ROLES.some(r => !drivers.some(d => d.id === team.lineup[r]))) return 'Choose a driver for every role.'
  if (new Set(ROLES.map(r => team.lineup[r])).size !== 3) return 'Each role needs a different driver.'
  if (lineupCost(team.lineup, drivers) > BUDGET) return `Your squad must fit the ${money(BUDGET)} budget.`
  return null
}
/** Selecting an existing squad member swaps their role, never duplicates them. */
export function assignDriver(lineup: Lineup, role: Role, driverId: string): Lineup {
  const next = { ...lineup }
  const previousRole = ROLES.find(r => lineup[r] === driverId)
  if (previousRole) next[previousRole] = lineup[role]
  next[role] = driverId
  return next
}
const position = (n: number | null): n is number => n !== null && Number.isInteger(n) && n > 0
const qualifyingPoints = (n: number | null) => position(n) ? Math.max(0, 11 - n) : 0
const racePoints = (n: number | null) => position(n) ? RACE_POINTS[n - 1] ?? 0 : 0

/** Pure scoring: production callers must supply final, trusted results on the server. */
export function scoreSquad(lineup: Lineup, results: readonly DriverResult[]): SquadScore {
  const drivers = ROLES.map(role => {
    const driverId = lineup[role]
    const row = results.find(r => r.driverId === driverId)
    if (!row) return { driverId, role, base: 0, bonus: 0, total: 0, lines: [{ label: 'No result', points: 0 }] }
    if (row.status === 'dsq') return { driverId, role, base: -10, bonus: 0, total: -10, lines: [{ label: 'Disqualified', points: -10 }] }
    const q = qualifyingPoints(row.qualifying)
    const race = row.status === 'finished' ? racePoints(row.finish) : 0
    const finish = row.status === 'finished' ? 2 : row.status === 'dnf' ? -5 : 0
    const base = q + race + finish
    const lines = [{ label: 'Qualifying', points: q }, { label: 'Race position', points: race },
      { label: row.status === 'dnf' ? 'Did not finish' : row.status === 'dns' ? 'Did not start' : 'Finished', points: finish }]
    let bonus = 0
    if (role === 'leader') bonus = q + race
    if (role === 'charger' && row.status === 'finished' && position(row.grid) && position(row.finish)) {
      bonus = Math.min(20, Math.max(0, row.grid - row.finish) * 2)
    }
    if (role === 'rival') {
      // Exactly one teammate: an ambiguous/missing roster cannot invent bonus points.
      const teammates = results.filter(r => r.team === row.team && r.driverId !== driverId)
      const mate = teammates.length === 1 ? teammates[0] : null
      if (mate) {
        if (position(row.qualifying) && position(mate.qualifying) && row.qualifying < mate.qualifying) bonus += 5
        if (row.status === 'finished' && position(row.finish) &&
          (mate.status === 'dnf' || (mate.status === 'finished' && position(mate.finish) && row.finish < mate.finish))) bonus += 8
      }
    }
    lines.push({ label: `${ROLE_INFO[role].name} bonus`, points: bonus })
    return { driverId, role, base, bonus, total: base + bonus, lines }
  })
  return { total: drivers.reduce((s, d) => s + d.total, 0), bonus: drivers.reduce((s, d) => s + d.bonus, 0), leader: drivers[0].total, drivers }
}

/** Published tie order: round points, role bonuses, leader points, then cup seed. */
export function matchWinner(a: string, b: string, scoreA: SquadScore, scoreB: SquadScore, seeds: readonly string[]): string {
  const delta = scoreA.total - scoreB.total || scoreA.bonus - scoreB.bonus || scoreA.leader - scoreB.leader
  return delta ? (delta > 0 ? a : b) : seeds.indexOf(a) < seeds.indexOf(b) ? a : b
}
