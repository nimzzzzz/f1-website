import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { resolveDriverParams } from '@/lib/static-params'
import { FALLBACK_DRIVER_CARDS } from '@/lib/roster-fallback'
import { DriverCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts, Wordmark } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Driver championship card'
export const revalidate = 60

export async function generateStaticParams() {
  return resolveDriverParams(await buildSeasonSnapshot()).values
}

// THE CARD DEGRADES BY DROPPING ONE LINE, NOT BY COLLAPSING.
//
// The numeral, name, team and livery come from the committed roster, so
// they survive a failed compute. Only the position/points line needs the
// bundle. This ordering is deliberate: social platforms cache an OG image
// on the first fetch and never follow ISR, so a wordmark baked during one
// throttled build would sit in Slack and X caches for weeks after the
// route itself healed. "Self-healing" was never true from the sharer's
// side.
export default async function Image({ params }: { params: Promise<{ acronym: string }> }) {
  const { acronym } = await params
  const key = acronym.toUpperCase()

  const stat = FALLBACK_DRIVER_CARDS.find((d) => d.acronym === key)

  // Live standing is best-effort and must never take the card down with it.
  let standing: { position: number; points: number } | undefined
  let live: typeof stat | undefined
  try {
    const snap = await buildSeasonSnapshot()
    if (!snap.blocked) {
      const d = snap.driverStandings.find((x) => x.nameAcronym?.toUpperCase() === key)
      if (d) {
        live = {
          acronym: key,
          number: d.driverNumber,
          first: d.firstName,
          surname: d.surname,
          team: d.teamName,
          colour: d.teamColour,
        }
        standing = { position: d.position, points: d.points }
      }
    }
  } catch {
    // Compute unavailable — the roster still carries everything else.
  }

  const base = live ?? stat
  // Only now, with no static row either, is a wordmark the honest answer.
  if (!base) return new ImageResponse(Wordmark(), { ...size, fonts: ogFonts })

  return new ImageResponse(
    DriverCard({
      number: base.number,
      first: base.first,
      surname: base.surname,
      team: base.team,
      colour: base.colour,
      standing,
    }),
    { ...size, fonts: ogFonts }
  )
}
