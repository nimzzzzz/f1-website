import { describe, it, expect } from 'vitest'
import { circuitImageForMeeting, CIRCUIT_ART_SUPPRESSED } from '@/lib/media-manifest'

// Circuit art used to be keyed by country_name, which is not unique: 2026
// has Bahrain hosting a cancelled round AND its Kuala Lumpur replacement,
// Spain hosting Barcelona and Madrid, and the United States hosting three
// rounds. Every one of those shared a single icon.

describe('circuitImageForMeeting', () => {
  it('gives rounds in the same country DIFFERENT art', () => {
    const miami = circuitImageForMeeting({ meeting_key: 1284, country_name: 'United States' })
    const austin = circuitImageForMeeting({ meeting_key: 1297, country_name: 'United States' })
    const vegas = circuitImageForMeeting({ meeting_key: 1300, country_name: 'United States' })
    expect(miami).toBeTruthy()
    expect(new Set([miami, austin, vegas]).size).toBe(3)
  })

  it('returns null for the Kuala Lumpur replacement rather than Bahrain’s outline', () => {
    // openf1 serves the Sakhir icon for meeting 1308 — a factually wrong
    // circuit shape. No art is the honest render until F1 publishes one.
    expect(circuitImageForMeeting({ meeting_key: 1308, country_name: 'Bahrain' })).toBeNull()
    expect(CIRCUIT_ART_SUPPRESSED.has('1308')).toBe(true)
  })

  it('does not fall back to a neighbour’s art when a meeting has none', () => {
    // Barcelona's own icon 404s upstream; a country fallback would draw
    // Madrid's circuit on the Barcelona round.
    expect(circuitImageForMeeting({ meeting_key: 1287, country_name: 'Spain' })).toBeNull()
    expect(circuitImageForMeeting({ meeting_key: 1294, country_name: 'Spain' })).toBeTruthy()
  })

  it('returns null for an unknown meeting instead of guessing by country', () => {
    expect(circuitImageForMeeting({ meeting_key: 999999, country_name: 'Hungary' })).toBeNull()
  })
})
