import { CALLS, CALL_INFO, predictionOutcome, scoreTicket, type PredictionSave } from './game'

export function predictionInsights(save: PredictionSave) {
  const weekends = save.entries.filter(e => e.revealed).map(e => ({ round: e.round, ticket: e.ticket, score: scoreTicket(e.ticket, predictionOutcome(e.round)) }))
  const categories = CALLS.map(call => {
    let current = 0, longest = 0
    for (const weekend of weekends) { current = weekend.score.calls.find(c => c.call === call)?.verdict === 'exact' ? current + 1 : 0; longest = Math.max(longest, current) }
    const calls = weekends.map(w => w.score.calls.find(c => c.call === call)!)
    const exact = calls.filter(c => c.verdict === 'exact').length
    return { call, label: CALL_INFO[call].label, exact, partial: calls.filter(c => c.verdict === 'partial').length, attempts: calls.length,
      percent: calls.length ? Math.round(exact / calls.length * 100) : null, current, longest,
      points: calls.reduce((n, c) => n + c.total, 0) }
  })
  let streak = 0, longest = 0, total = 0, century: number | null = null, streakRound: number | null = null
  for (const w of weekends) {
    streak = w.score.exact > 0 ? streak + 1 : 0; longest = Math.max(longest, streak)
    total += w.score.total
    if (total >= 100 && century === null) century = w.round
    if (streak >= 3 && streakRound === null) streakRound = w.round
  }
  const perfectPodium = (w: typeof weekends[number]) => w.score.calls.filter(c => ['first', 'second', 'third'].includes(c.call)).every(c => c.verdict === 'exact')
  const first = (test: (w: typeof weekends[number]) => boolean) => weekends.find(test)?.round ?? null
  return { weekends, categories, currentStreak: streak, longestStreak: longest,
    boostPaid: weekends.filter(w => w.score.bonus > 0).length, boostPoints: weekends.reduce((n, w) => n + w.score.bonus, 0),
    strongest: weekends.length ? [...categories].sort((a, b) => b.exact - a.exact || b.points - a.points)[0] : null,
    milestones: [
      { name: 'On the record', description: 'Complete your first prediction weekend.', round: weekends[0]?.round ?? null },
      { name: 'Podium oracle', description: 'Call all three podium places exactly.', round: first(perfectPodium) },
      { name: 'Three in a row', description: 'Make at least one exact call across three consecutive weekends.', round: streakRound },
      { name: 'Called everything', description: 'Land all six calls in the same weekend.', round: first(w => w.score.exact === 6) },
      { name: 'Backed the winner', description: 'Use your confidence boost on the correct race winner.', round: first(w => w.ticket.boost === 'first' && w.score.calls[1].verdict === 'exact') },
      { name: 'Century club', description: 'Reach 100 prediction points across the season.', round: century },
    ] }
}
