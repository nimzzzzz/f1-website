import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import RaceControlClient from './RaceControlClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// RaceControlClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'race-control',
  title: 'RACE CONTROL',
  description:
    "The flags, incidents, penalties and safety-car calls of a session, newest first.",
  noindex: true,
})

export default function Page() {
  return <RaceControlClient />
}
