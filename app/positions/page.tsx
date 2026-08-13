import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import PositionsClient from './PositionsClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// PositionsClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'positions',
  title: 'POSITIONS',
  description:
    "How the order changed through a session, from lights out to the flag.",
  noindex: true,
})

export default function Page() {
  return <PositionsClient />
}
