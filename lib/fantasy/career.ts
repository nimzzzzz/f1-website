import { buildCup, nextMatch, practiceResults, standings } from './practice'
import { compareRoles, scoreSquad } from './rules'
import type { PracticeSave } from './types'

export function raceDuel(save: PracticeSave, round: number) {
  const entry = save.entries.find(e => e.round === round)
  if (!entry) return null
  const match = nextMatch({ ...save, entries: save.entries.slice(0, round - 1) })
  if (!match) return null
  const results = practiceResults(round)
  const you = scoreSquad(entry.lineup, results)
  const opponent = scoreSquad(match.opponent.lineup, results)
  const cupMatch = buildCup(save, Math.ceil(round / 4)).stages.flat().find(m => m.round === round && (m.a === 'you' || m.b === 'you'))
  const difference = you.total - opponent.total
  return { ...match, you, opponentScore: opponent, difference, round,
    verdict: cupMatch ? cupMatch.winner === 'you' ? 'win' : 'loss' : difference > 0 ? 'win' : difference < 0 ? 'loss' : 'draw',
    tiebreak: Boolean(cupMatch?.tiebreak), cupFinal: round % 4 === 0 && Boolean(cupMatch),
  }
}

export function fantasyCareer(save: PracticeSave) {
  const history = save.entries.map((entry, index) => {
    const you = standings(save, index + 1).find(row => row.id === 'you')!
    const previousRank = index ? standings(save, index).find(row => row.id === 'you')!.rank : null
    const score = you.scores.at(-1)!
    const duel = raceDuel(save, entry.round)
    const bestRoles = compareRoles(entry.lineup, practiceResults(entry.round))[0]
    return { round: entry.round, rank: you.rank, total: you.total, points: score.total, bonus: score.bonus,
      movement: previousRank === null ? 0 : previousRank - you.rank, duel,
      optimal: score.bonus > 0 && bestRoles.score.total === score.total }
  })
  const cups = Array.from({ length: Math.floor(save.entries.length / 4) }, (_, i) => buildCup(save, i + 1))
  const trophies = cups.filter(cup => cup.champion === 'you').map(cup => ({ number: cup.number, round: cup.number * 4 }))
  let streak = 0, longest = 0
  for (const race of history) { streak = race.duel?.verdict === 'win' ? streak + 1 : 0; longest = Math.max(streak, longest) }
  const earned = (predicate: (race: typeof history[number]) => boolean) => history.find(predicate)?.round ?? null
  const achievements = [
    { id: 'debut', name: 'Lights out', description: 'Complete your first weekend.', round: history[0]?.round ?? null },
    { id: 'century', name: 'Triple digits', description: 'Reach 100 championship points.', round: earned(r => r.total >= 100) },
    { id: 'roles', name: 'Perfect placement', description: 'Earn the highest score possible with your three drivers.', round: earned(r => r.optimal) },
    { id: 'comeback', name: 'On the charge', description: 'Climb at least three championship places in one race.', round: earned(r => r.movement >= 3) },
    { id: 'close', name: 'By a nose', description: 'Win a head-to-head by five points or fewer, including a tiebreak.', round: earned(r => r.duel?.verdict === 'win' && (r.duel?.difference ?? 99) <= 5) },
    { id: 'cup', name: 'Cup champion', description: 'Win a four-race knockout cup.', round: trophies[0]?.round ?? null },
  ]
  const best = history.reduce<typeof history[number] | null>((top, race) => !top || race.points > top.points ? race : top, null)
  return { history, trophies, achievements, best, longestWinStreak: longest, currentWinStreak: streak,
    wins: history.filter(r => r.duel?.verdict === 'win').length, losses: history.filter(r => r.duel?.verdict === 'loss').length,
    draws: history.filter(r => r.duel?.verdict === 'draw').length }
}
