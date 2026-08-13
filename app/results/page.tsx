import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import ResultsClient from './ResultsClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// ResultsClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'results',
  title: 'RESULTS',
  description:
    "The finishing order from the latest completed session — winner, podium, gaps and pit stops.",
  // Consistent with the other six session pages: the URL carries no
  // session, so this is a tool rather than a document, and it serves the
  // same shell to a crawler as the rest.
  noindex: true,
})

export default function Page() {
  return <ResultsClient />
}
