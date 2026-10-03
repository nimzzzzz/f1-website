// Practice is deliberately separate from any future shared competition.
// Every result and computer opponent here is simulated, never an F1 result.
import { FALLBACK_DRIVER_CARDS } from '@/lib/roster-fallback'
import { BUDGET, COLOURS, CUP_ROUNDS, SEASON_ROUNDS, lineupCost, matchWinner, scoreSquad, validateTeam } from './rules'
import { ROLES, type Competitor, type Cup, type CupMatch, type DriverResult, type FantasyDriver, type Lineup, type PracticeSave, type Standing } from './types'

const PRICES: Record<string, number> = { NOR: 294, VER: 290, LEC: 266, RUS: 281, ANT: 274, HAM: 252, PIA: 268, HAD: 170, GAS: 149, ALB: 124, SAI: 140, ALO: 132, LAW: 120, LIN: 107, OCO: 113, BEA: 128, HUL: 118, BOR: 101, COL: 105, STR: 108, PER: 99, BOT: 95 }
export const PRACTICE_DRIVERS: FantasyDriver[] = FALLBACK_DRIVER_CARDS.map(d => ({
  id: d.acronym, first: d.first, surname: d.surname, number: d.number,
  team: d.team, colour: `#${d.colour}`, price: PRICES[d.acronym],
})).filter(d => Number.isFinite(d.price)).sort((a, b) => b.price - a.price)
export const STORAGE_KEY = 'lights-out:fantasy:practice:v1'
export const DEFAULT_SAVE: PracticeSave = { version: 1, team: { name: 'APEX WORKS', colour: COLOURS[0].value, lineup: { leader: 'NOR', charger: 'ALB', rival: 'GAS' } }, entries: [] }
const TEAM_NAMES = ['Late Brakers', 'Parc Ferme', 'Slipstream Club', 'Sector Seven', 'No Lift Racing', 'Kerb Appeal', 'Apex Hunters', 'Box Box Racing', 'Night Shift', 'Purple Sector', 'Flat Out Club', 'Overcut Works', 'Final Lap', 'Sidepod Society', 'Undercut Union']

function random(seed: number) {
  let x = seed | 0
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296 }
}
function computerLineup(index: number): Lineup {
  const rng = random(381 + index * 771)
  for (let attempt = 0; attempt < 200; attempt++) {
    const picks = [...PRACTICE_DRIVERS].map(d => ({ d, order: rng() })).sort((a, b) => a.order - b.order).slice(0, 3).map(x => x.d)
    const lineup = { leader: picks[0].id, charger: picks[1].id, rival: picks[2].id }
    if (lineupCost(lineup, PRACTICE_DRIVERS) <= BUDGET) return lineup
  }
  return { ...DEFAULT_SAVE.team.lineup }
}
export const COMPUTERS: Competitor[] = TEAM_NAMES.map((name, i) => ({ id: `cpu-${String(i + 1).padStart(2, '0')}`, name, colour: COLOURS[(i + 1) % COLOURS.length].value, computer: true, lineup: computerLineup(i) }))
export function competitors(save: PracticeSave): Competitor[] {
  return [{ id: 'you', name: save.team.name, colour: save.team.colour, computer: false, lineup: save.team.lineup }, ...COMPUTERS]
}
export function practiceResults(round: number): DriverResult[] {
  const rng = random(202600 + round * 7919)
  const quali = PRACTICE_DRIVERS.map(d => ({ d, pace: d.price / 10 + rng() * 22 })).sort((a, b) => b.pace - a.pace)
  const race = quali.map((x, i) => ({ ...x, grid: i + 1, retired: rng() < 0.085, racePace: x.pace + rng() * 28 })).sort((a, b) => Number(a.retired) - Number(b.retired) || b.racePace - a.racePace)
  return race.map((x, i) => ({ driverId: x.d.id, team: x.d.team, qualifying: x.grid, grid: x.grid, finish: x.retired ? null : i + 1, status: x.retired ? 'dnf' : 'finished' }))
}
export function standings(save: PracticeSave, throughRound = save.entries.length): Standing[] {
  const rows = competitors(save).map(team => {
    const scores = save.entries.slice(0, throughRound).map(entry => scoreSquad(team.id === 'you' ? entry.lineup : team.lineup, practiceResults(entry.round)))
    return { ...team, rank: 0, total: scores.reduce((sum, score) => sum + score.total, 0), last: scores.at(-1)?.total ?? 0, scores }
  }).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
  return rows.map((row, i) => ({ ...row, rank: i > 0 && row.total === rows[i - 1].total ? rows.findIndex(r => r.total === row.total) + 1 : i + 1 }))
}
export function buildCup(save: PracticeSave, number: number): Cup {
  const start = (number - 1) * CUP_ROUNDS
  const table = standings(save)
  // Seed once using ONLY scores before this cup. First cup is a fixed draw.
  const seeds = start === 0 ? competitors(save).map(c => c.id) : standings(save, start).map(c => c.id)
  const draw = [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10]
  let players: (string | null)[] = draw.map(i => seeds[i])
  const stages: CupMatch[][] = []
  for (let stage = 0; stage < CUP_ROUNDS; stage++) {
    const round = start + stage + 1
    const matches: CupMatch[] = []
    for (let i = 0; i < players.length; i += 2) {
      const a = players[i], b = players[i + 1]
      const scoreA = a ? table.find(t => t.id === a)?.scores[round - 1] ?? null : null
      const scoreB = b ? table.find(t => t.id === b)?.scores[round - 1] ?? null : null
      const winner = a && b && scoreA && scoreB ? matchWinner(a, b, scoreA, scoreB, seeds) : null
      matches.push({ id: `cup-${number}-${stage}-${i}`, round, a, b, scoreA, scoreB, winner, tiebreak: Boolean(scoreA && scoreB && scoreA.total === scoreB.total) })
    }
    stages.push(matches)
    players = matches.map(m => m.winner)
  }
  return { number, seeds, stages, champion: stages[3][0].winner }
}
export function currentCupNumber(completed: number) { return Math.min(SEASON_ROUNDS / CUP_ROUNDS, Math.floor(completed / CUP_ROUNDS) + 1) }
export function nextMatch(save: PracticeSave): { opponent: Competitor; consolation: boolean } | null {
  if (save.entries.length >= SEASON_ROUNDS) return null
  const round = save.entries.length + 1
  const cup = buildCup(save, currentCupNumber(save.entries.length))
  const matches = cup.stages[(round - 1) % CUP_ROUNDS]
  const match = matches.find(m => m.a === 'you' || m.b === 'you')
  const teams = competitors(save)
  const opponent = match ? teams.find(t => t.id === (match.a === 'you' ? match.b : match.a)) : null
  if (opponent) return { opponent, consolation: false }
  // Eliminated teams are paired by standing, excluding everybody still in the cup.
  const active = new Set(matches.flatMap(m => [m.a, m.b]))
  const eliminated = standings(save).filter(t => !active.has(t.id))
  const index = eliminated.findIndex(t => t.id === 'you')
  const other = eliminated[index % 2 === 0 ? index + 1 : index - 1]
  return other ? { opponent: other, consolation: true } : null
}
export function playRound(save: PracticeSave): PracticeSave {
  const error = validateTeam(save.team, PRACTICE_DRIVERS)
  if (error) throw new Error(error)
  if (save.entries.length >= SEASON_ROUNDS) throw new Error('This practice season is complete.')
  return { ...save, entries: [...save.entries, { round: save.entries.length + 1, lineup: { ...save.team.lineup } }] }
}
/** Reject corrupt/old saves. Recalculate all scores; never trust stored totals. */
export function parseSave(raw: string | null): PracticeSave | null {
  if (!raw || raw.length > 25000) return null
  try {
    const value = JSON.parse(raw) as PracticeSave
    if (value?.version !== 1 || !value.team || validateTeam(value.team, PRACTICE_DRIVERS) || !Array.isArray(value.entries) || value.entries.length > SEASON_ROUNDS) return null
    if (value.entries.some((e, i) => !e || e.round !== i + 1 || validateTeam({ ...value.team, lineup: e.lineup }, PRACTICE_DRIVERS))) return null
    return { version: 1, team: { name: value.team.name.trim(), colour: value.team.colour, lineup: Object.fromEntries(ROLES.map(r => [r, value.team.lineup[r]])) as Lineup }, entries: value.entries.map(e => ({ round: e.round, lineup: Object.fromEntries(ROLES.map(r => [r, e.lineup[r]])) as Lineup })) }
  } catch { return null }
}
