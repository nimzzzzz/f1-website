import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { isCancelled } from '@/lib/openf1'
import { RaceCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Next race card'
export const revalidate = 60

const fmt = (a: string, b: string) => {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(a).toLocaleDateString('en-US', o)} — ${new Date(b).toLocaleDateString('en-US', o)}`.toUpperCase()
}

// The calendar's card shows the NEXT round, so a shared /schedule link is
// about the weekend ahead rather than the season in the abstract.
export default async function Image() {
  const snap = await buildSeasonSnapshot()
  const now = Date.now()
  let card = { round: 0, name: '', circuit: '', dates: '' }

  if (!snap.blocked) {
    const rounds = snap.meetings
      .filter(
        (m) =>
          !m.meeting_name.toLowerCase().includes('testing') &&
          !m.meeting_name.toLowerCase().includes('pre-season')
      )
      .sort((a, b) => +new Date(a.date_start) - +new Date(b.date_start))
    const scored = rounds.filter((m) => !isCancelled(m))
    const next = scored.find((m) => +new Date(m.date_end) > now) ?? scored[scored.length - 1]
    if (next) {
      card = {
        round: scored.indexOf(next) + 1,
        name: next.meeting_name,
        circuit: next.circuit_short_name,
        dates: fmt(next.date_start, next.date_end),
      }
    }
  }

  if (!card.circuit) {
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
  return new ImageResponse(RaceCard(card), { ...size, fonts: ogFonts })
}
