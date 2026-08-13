import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import PitStopsClient from './PitStopsClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// PitStopsClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'pit-stops',
  title: 'PIT STOPS',
  description:
    "Every stop of a race, timed to the hundredth, fastest first.",
  noindex: true,
})

export default function Page() {
  return <PitStopsClient />
}
