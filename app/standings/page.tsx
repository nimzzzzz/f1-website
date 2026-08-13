import { buildSeasonSnapshot } from '@/lib/season-data-server'
import StandingsClient from './StandingsClient'

// STATIC with ISR — see the note on app/page.tsx. This route was
// force-dynamic only because its server shell HTTP-fetched its own
// deployment via a headers()-derived origin; nothing on the page needs
// request-time data. useFreshSeasonBundle in StandingsClient keeps a
// long-lived tab current on top of the ISR snapshot.
export const revalidate = 60
// Background revalidations fetch ~22 paced openf1 result sets.
export const maxDuration = 60

export default async function StandingsPage() {
  // Local verification hook for the cold-cache lockout path (unset in prod).
  if (process.env.SIMULATE_SEASON_BLOCKED === '1') {
    return <StandingsClient initialBundle={null} />
  }
  const snap = await buildSeasonSnapshot()
  return <StandingsClient initialBundle={snap.blocked ? null : snap} />
}
