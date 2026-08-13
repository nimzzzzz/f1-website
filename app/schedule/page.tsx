import type { Metadata } from 'next'
import { routeMeta } from '@/lib/seo'
import ScheduleClient from './ScheduleClient'
import JsonLd from '@/components/seo/JsonLd'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { isCancelled } from '@/lib/openf1'
import { SITE_URL } from '@/lib/seo'

// Server shell so this route can carry metadata: a 'use client' module
// cannot export it. The page itself is unchanged — it moved into
// ScheduleClient and is rendered here untouched.
export const metadata: Metadata = routeMeta({
  path: 'schedule',
  title: 'THE CALENDAR',
  description:
    "All 23 scored rounds of the 2026 season, the two that were cancelled, and every session time for the weekend ahead.",
})

// SportsEvent per round, built on the server from the same bundle the page
// renders — so the markup cannot disagree with what a visitor sees.
// eventStatus is the point: the site models cancellation properly, so the
// two cancelled rounds say EventCancelled rather than being dropped (which
// would hide them) or listed as scheduled (which would be false).
export default async function Page() {
  const snap = await buildSeasonSnapshot()
  const rounds = snap.blocked
    ? []
    : snap.meetings
        .filter(
          (m) =>
            !m.meeting_name.toLowerCase().includes('testing') &&
            !m.meeting_name.toLowerCase().includes('pre-season')
        )
        .map((m) => {
          const cancelled = isCancelled(m)
          const race = snap.sessions.find(
            (s) => s.meeting_key === m.meeting_key && s.session_name === 'Race'
          )
          return {
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: m.meeting_name,
            startDate: race?.date_start ?? m.date_start,
            ...(race?.date_end ? { endDate: race.date_end } : {}),
            eventStatus: cancelled
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: {
              '@type': 'Place',
              name: m.circuit_short_name,
              address: {
                '@type': 'PostalAddress',
                addressLocality: m.location,
                addressCountry: m.country_name,
              },
            },
            url: `${SITE_URL}/schedule`,
          }
        })

  return (
    <>
      {rounds.length > 0 && <JsonLd data={rounds} />}
      <ScheduleClient />
    </>
  )
}
