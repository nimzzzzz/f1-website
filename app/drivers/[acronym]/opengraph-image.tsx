import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { resolveDriverParams } from '@/lib/static-params'
import { DriverCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Driver championship card'
// Same regime as the page: generated at build and refreshed by ISR, never
// at request time. A share card must not be able to fail on someone's
// paste — if the bundle is unavailable the route falls back below.
export const revalidate = 60

export async function generateStaticParams() {
  return resolveDriverParams(await buildSeasonSnapshot()).values
}

export default async function Image({ params }: { params: Promise<{ acronym: string }> }) {
  const { acronym } = await params
  const snap = await buildSeasonSnapshot()
  const d = snap.blocked
    ? undefined
    : snap.driverStandings.find((x) => x.nameAcronym?.toUpperCase() === acronym.toUpperCase())

  // Degrade to the site wordmark rather than 500ing: a broken share card is
  // worse than a plain one.
  if (!d) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', background: '#0a0a0a', color: '#f5f5f3',
                      fontSize: 84, fontWeight: 900, letterSpacing: -2, fontFamily: 'Geist' }}>
          LIGHTS OUT
        </div>
      ),
      { ...size, fonts: ogFonts }
    )
  }

  return new ImageResponse(
    DriverCard({
      number: d.driverNumber,
      first: d.firstName,
      surname: d.surname,
      team: d.teamName,
      colour: d.teamColour,
      position: d.position,
      points: d.points,
    }),
    { ...size, fonts: ogFonts }
  )
}
