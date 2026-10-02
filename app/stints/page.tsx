import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import StintsClient from './StintsClient'

// Route metadata remains on the server; interactive session data lives in
// StintsClient.
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
