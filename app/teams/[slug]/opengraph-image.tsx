import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { resolveTeamParams } from '@/lib/static-params'
import { teamToSlug } from '@/lib/team-data'
import { TeamCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Constructor championship card'
export const revalidate = 60

export async function generateStaticParams() {
  return resolveTeamParams(await buildSeasonSnapshot()).values
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const snap = await buildSeasonSnapshot()
  const t = snap.blocked
    ? undefined
    : snap.teamStandings.find((x) => teamToSlug(x.teamName) === slug)

  if (!t) {
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
    TeamCard({
      name: t.teamName,
      colour: t.teamColour,
      position: t.position,
      points: t.points,
      drivers: t.driverSurnames,
    }),
    { ...size, fonts: ogFonts }
  )
}
