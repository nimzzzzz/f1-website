import { ImageResponse } from 'next/og'
import { buildSeasonSnapshot } from '@/lib/season-data-server'
import { isCancelled } from '@/lib/openf1'
import { FALLBACK_CALENDAR } from '@/lib/roster-fallback'
import { RaceCard, OG_SIZE, OG_CONTENT_TYPE, ogFonts, Wordmark } from '@/lib/og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Next race card'
export const revalidate = 60

const fmt = (a: string, b: string) => {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(a).toLocaleDateString('en-US', o)} — ${new Date(b).toLocaleDateString('en-US', o)}`.toUpperCase()
}

/** The round in progress or the one ahead; the finale once the season ends. */
function pickNext<T extends { start: string; end: string }>(rounds: T[], now: number): T | undefined {
  return rounds.find((r) => +new Date(r.end) > now) ?? rounds[rounds.length - 1]
}

// The calendar's card shows the NEXT round, so a shared /schedule link is
// about the weekend ahead rather than the season in the abstract.
//
// WHICH round is a published fact months out, so it comes from the
// committed calendar snapshot and does not need the compute at all. A live
// bundle only refines it — a renamed or newly-cancelled round. Same reason
// as the driver card: a wordmark baked here would be cached by every
// platform that saw it first, long after the route recovered.
export default async function Image() {
  const now = Date.now()

  const stat = pickNext([...FALLBACK_CALENDAR], now)
  let card = stat
    ? { round: stat.round, name: stat.name, circuit: stat.circuit, dates: fmt(stat.start, stat.end) }
    : { round: 0, name: '', circuit: '', dates: '' }

  let snap: Awaited<ReturnType<typeof buildSeasonSnapshot>> | { blocked: true } = { blocked: true }
  try {
    snap = await buildSeasonSnapshot()
  } catch {
    // Compute unavailable — the snapshot above already carries the round.
  }

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

  // Only reachable if the committed calendar is empty too.
  if (!card.circuit) return new ImageResponse(Wordmark(), { ...size, fonts: ogFonts })
  return new ImageResponse(RaceCard(card), { ...size, fonts: ogFonts })
}
