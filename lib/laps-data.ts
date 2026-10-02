import { getCachedStints, getCachedPitStops } from './client-cache'
import { okResult } from './fetch-result'
import type { PitStop, Stint } from './openf1'

export type LapContext = { stints: Stint[] | null; stops: PitStop[] | null }

// Enrichment arrives after the laps. Unknown tyre/pit data remains null,
// independent of a successful response containing zero rows.
export async function getLapContext(key: number) {
  const [stints, stops] = await Promise.allSettled([getCachedStints(key), getCachedPitStops(key)])
  return okResult<LapContext>([{
    stints: stints.status === 'fulfilled' && stints.value.ok ? stints.value.rows : null,
    stops: stops.status === 'fulfilled' && stops.value.ok ? stops.value.rows : null,
  }])
}
getLapContext.refresh = async (key: number) => {
  const [stints, stops] = await Promise.allSettled([getCachedStints.refresh(key), getCachedPitStops.refresh(key)])
  return okResult<LapContext>([{
    stints: stints.status === 'fulfilled' && stints.value.ok ? stints.value.rows : null,
    stops: stops.status === 'fulfilled' && stops.value.ok ? stops.value.rows : null,
  }])
}
