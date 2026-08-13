import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import WeatherClient from './WeatherClient'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// WeatherClient and is rendered here untouched.
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
