import { getSeasonBundleSSR } from '@/lib/season-data-ssr'
import HomeClient from './HomeClient'

// Server shell: one internal fetch of the static ISR season snapshot
// (instant — it serves like a static file) injected into the client home,
// so the calendar, THE FIGHT, and LAST TIME OUT are in the first HTML
// instead of arriving after a client fetch.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const bundle = await getSeasonBundleSSR()
  return <HomeClient initialBundle={bundle} />
}
