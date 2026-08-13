import { describe, it, expect } from 'vitest'
import {
  FALLBACK_DRIVER_ACRONYMS,
  FALLBACK_TEAM_SLUGS,
  FALLBACK_DRIVER_CARDS,
  FALLBACK_CALENDAR,
} from '@/lib/roster-fallback'
import { slugToTeam, TEAM_COLOURS } from '@/lib/team-data'

// A SHARE CARD MUST NEVER DEGRADE TO THE WORDMARK.
//
// Social platforms fetch an OG image once, cache it, and do not follow ISR
// revalidation. So a card baked as a bare wordmark during one throttled
// build sits in Slack, X and LinkedIn caches for weeks after the route
// itself healed — "it self-heals" was never true from the sharer's side.
//
// The design that follows from that: a card degrades by DROPPING ITS DATA
// LINE, not by collapsing. Numeral, name and livery come from the committed
// roster snapshot, which is the same file the build-completeness guard
// resolves its params from, so they are available exactly when the compute
// is not. The wordmark survives only as a last resort for a slug the
// snapshot has never heard of.
//
// These tests pin the property that makes that true: the static half must
// COVER every route the build will generate. A card missing from the
// snapshot is a wordmark waiting to be cached by someone's Slack.

describe('the static half covers every generated route', () => {
  it('every driver route has a card that needs no compute', () => {
    const covered = new Set(FALLBACK_DRIVER_CARDS.map((d) => d.acronym))
    const missing = FALLBACK_DRIVER_ACRONYMS.filter((a) => !covered.has(a.toUpperCase()))
    expect(missing).toEqual([])
  })

  it('every driver card carries a number, a name and a livery', () => {
    for (const d of FALLBACK_DRIVER_CARDS) {
      expect(d.number, d.acronym).toBeGreaterThan(0)
      expect(d.surname, d.acronym).not.toBe('')
      expect(d.team, d.acronym).not.toBe('')
      // Satori will not parse #RRGGBBAA; the wash converts to rgba() from a
      // plain six-digit hex, so anything else renders as a black card.
      expect(d.colour, d.acronym).toMatch(/^[0-9a-fA-F]{6}$/)
    }
  })

  it('every team route resolves a name and a livery statically', () => {
    for (const slug of FALLBACK_TEAM_SLUGS) {
      const name = slugToTeam(slug)
      expect(name, slug).toBeTruthy()
      expect(TEAM_COLOURS[name!]?.bright, slug).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('the calendar snapshot stands in for the compute', () => {
  it('is a plausible season, numbered contiguously from one', () => {
    expect(FALLBACK_CALENDAR.length).toBeGreaterThanOrEqual(15)
    expect(FALLBACK_CALENDAR.map((r) => r.round)).toEqual(
      FALLBACK_CALENDAR.map((_, i) => i + 1)
    )
  })

  it('is in date order, so "the next round" is the first one not yet ended', () => {
    const starts = FALLBACK_CALENDAR.map((r) => +new Date(r.start))
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    for (const r of FALLBACK_CALENDAR) {
      expect(Number.isNaN(+new Date(r.end)), r.name).toBe(false)
      expect(r.circuit, r.name).not.toBe('')
    }
  })

  it('still names a round after the finale, rather than nothing', () => {
    // The card falls back to the last round once the season is over — an
    // empty card here would be the wordmark by another route.
    const afterSeason = +new Date('2027-06-01')
    const rounds = [...FALLBACK_CALENDAR]
    const pick = rounds.find((r) => +new Date(r.end) > afterSeason) ?? rounds[rounds.length - 1]
    expect(pick?.circuit).toBeTruthy()
  })
})
