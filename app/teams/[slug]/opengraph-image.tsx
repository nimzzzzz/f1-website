import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { resolveTeamParams } from '@/lib/static-params'
import { teamToSlug, slugToTeam, TEAM_COLOURS } from '@/lib/team-data'
import { TeamCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts, Wordmark } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Constructor championship card'
export const revalidate = 60

export async function generateStaticParams() {
  return resolveTeamParams(await buildSeasonSnapshot()).values
}

// See the driver card: name and livery are static, only the standing needs
// the compute, and losing it costs one line rather than the whole card.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const staticName = slugToTeam(slug)

  let standing: { position: number; points: number; drivers: string[] } | undefined
  let liveName: string | undefined
  let liveColour: string | undefined
  try {
    const snap = await buildSeasonSnapshot()
    if (!snap.blocked) {
      const t = snap.teamStandings.find((x) => teamToSlug(x.teamName) === slug)
      if (t) {
        liveName = t.teamName
        liveColour = t.teamColour
        standing = { position: t.position, points: t.points, drivers: t.driverSurnames }
      }
    }
  } catch {
    // Compute unavailable — the static name and livery still stand.
  }

  const name = liveName ?? staticName
  if (!name) return new ImageResponse(Wordmark(), { ...size, fonts: ogFonts })
  const colour = liveColour ?? TEAM_COLOURS[name]?.bright?.replace('#', '') ?? 'F5F5F3'

  return new ImageResponse(TeamCard({ name, colour, standing }), { ...size, fonts: ogFonts })
}
