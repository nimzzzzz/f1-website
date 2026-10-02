import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import RaceControlClient from './RaceControlClient'

// Route metadata remains on the server; interactive session data lives in
// RaceControlClient.
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
