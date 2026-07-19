import { getSeasonBundleSSR } from '@/lib/season-data-ssr'
import StandingsClient from './StandingsClient'

// Server shell: the static ISR season snapshot injected at SSR, so the
// towers paint with the HTML instead of after a client fetch.
export const dynamic = 'force-dynamic'

export default async function StandingsPage() {
  const bundle = await getSeasonBundleSSR()
  return <StandingsClient initialBundle={bundle} />
}
