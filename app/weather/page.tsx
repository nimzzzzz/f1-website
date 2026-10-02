import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import WeatherClient from './WeatherClient'

// Route metadata remains on the server; interactive session data lives in
// WeatherClient.
export const metadata: Metadata = routeMeta({
  path: 'weather',
  title: 'WEATHER',
  description:
    "Track and air temperature, wind and rainfall across a session.",
  noindex: true,
})

export default function Page() {
  return <WeatherClient />
}
