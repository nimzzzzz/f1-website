import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import LapsClient from './LapsClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// LapsClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'laps',
  title: 'LAP TIMES',
  description:
    "Every lap of a session, with the fastest of the day called out.",
  noindex: true,
})

export default function Page() {
  return <LapsClient />
}
