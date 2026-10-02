import type { MachineWeekend } from './season-view'

/** Select the latest published GP, otherwise the first active weekend. */
export function latestTeamWeekend(weekends: MachineWeekend[]): MachineWeekend | null {
  return [...weekends].reverse().find((w) => w.status === 'complete')
    ?? weekends.find((w) => w.status !== 'cancelled')
    ?? weekends[0]
    ?? null
}

/** Scores follow the named drivers, not their historical team assignments. */
export function weekendDriverPoints(weekend: MachineWeekend) {
  if (weekend.status === 'cancelled') return { grandPrix: 0, sprint: 0, total: null }
  const grandPrix = weekend.status === 'complete' ? weekend.results.reduce((sum, r) => sum + r.points, 0) : 0
  const sprint = weekend.results.reduce((sum, r) => sum + r.sprintPoints, 0)
  return { grandPrix, sprint, total: weekend.status === 'complete' || sprint > 0 ? grandPrix + sprint : null }
}
