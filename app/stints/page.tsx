import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import StintsClient from './StintsClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// StintsClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'stints',
  title: 'STINTS',
  description:
    "Tyre strategy across a race — compound and stint length for every driver.",
  noindex: true,
})

export default function Page() {
  return <StintsClient />
}
