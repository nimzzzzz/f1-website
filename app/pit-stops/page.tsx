import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import PitStopsClient from './PitStopsClient'

// Keep metadata on the server; timing and replay are client interactions.
export const metadata: Metadata = routeMeta({
  path: 'pit-stops',
  title: 'PIT STOPS',
  description:
    'Explore every pit visit, stationary and pit-lane timings, tyre changes and team comparisons.',
  noindex: true,
})

export default function Page() {
  return <PitStopsClient />
}
