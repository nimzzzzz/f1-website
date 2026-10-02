import { getCachedPositions, getCachedSessionResult, getCachedStartingGrid, getCachedPitStops, getCachedSessions } from './client-cache'
import type { CachedFetcher } from './client-cache'
import type { Position, PitStop, StartingGrid } from './openf1'
import { okResult, type FetchResult } from './fetch-result'
import { classifyResults, gridSessionFor, type ResultEntry } from './results-story'

async function classification(key: number, fresh: boolean): Promise<FetchResult<ResultEntry>> {
  const details = await (fresh ? getCachedSessionResult.refresh(key) : getCachedSessionResult(key))
  if (details.ok && details.rows.length) return okResult(classifyResults(details.rows, []))
  const positions = await (fresh ? getCachedPositions.refresh(key) : getCachedPositions(key))
  if (positions.ok && positions.rows.length) return okResult(classifyResults([], positions.rows))
  // An empty timing feed doesn't erase a failed published-results request.
  if (!details.ok) return details
  if (!positions.ok) return positions
  return okResult([])
}
export const getResultClassification = Object.assign(
  (key: number) => classification(key, false),
  { refresh: (key: number) => classification(key, true) },
) satisfies CachedFetcher<ResultEntry>

export interface RaceExtras {
  grid: StartingGrid[] | null
  positions: Position[] | null
  stops: PitStop[] | null
}
async function gridForRace(key: number, fresh: boolean): Promise<FetchResult<StartingGrid>> {
  const sessions = await getCachedSessions()
  if (!sessions.ok) return sessions
  const race = sessions.rows.find((s) => s.session_key === key)
  const qualifying = race ? gridSessionFor(race, sessions.rows) : null
  if (!qualifying) return okResult([])
  return fresh ? getCachedStartingGrid.refresh(qualifying.session_key) : getCachedStartingGrid(qualifying.session_key)
}
async function raceExtras(key: number, fresh: boolean): Promise<FetchResult<RaceExtras>> {
  const [grid, positions, stops] = await Promise.all([
    gridForRace(key, fresh),
    fresh ? getCachedPositions.refresh(key) : getCachedPositions(key),
    fresh ? getCachedPitStops.refresh(key) : getCachedPitStops(key),
  ])
  // Partial enrichment is useful. Null means unavailable; [] means a
  // successful empty answer (especially important for zero pit stops).
  return okResult([{
    grid: grid.ok ? grid.rows : null,
    positions: positions.ok ? positions.rows : null,
    stops: stops.ok ? stops.rows : null,
  }])
}
export const getRaceExtras = Object.assign(
  (key: number) => raceExtras(key, false),
  { refresh: (key: number) => raceExtras(key, true) },
) satisfies CachedFetcher<RaceExtras>
