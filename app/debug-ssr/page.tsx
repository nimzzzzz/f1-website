import { getCachedSeasonData } from '@/lib/season-data-server'

// TEMPORARY diagnostic for the SSR bundle read on Vercel — remove after use.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export default async function DebugSSR() {
  const started = Date.now()
  let outcome = ''
  try {
    const b = await getCachedSeasonData()
    outcome = `OK computedAt=${b.computedAt} races=${b.completedRaces} p1=${b.driverStandings[0]?.surname}`
  } catch (err) {
    const e = err as Error
    outcome = `ERR name=${e?.name} msg=${e?.message}`
  }
  return (
    <pre style={{ padding: 40, fontSize: 12 }}>
      {outcome} elapsed={Date.now() - started}ms
    </pre>
  )
}
