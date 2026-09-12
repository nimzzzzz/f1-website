import { describe, expect, it } from 'vitest'
import { formatScheduleDates, formatScheduleTime, trackOffsetMinutes, trackTimeLabel } from '../lib/schedule-time'

describe('Schedule time zones', () => {
  it('uses the session track offset independently of the visitor time zone', () => {
    expect(formatScheduleTime('2026-09-12T14:00:00Z', 'track', '02:00:00', 'America/New_York')).toBe('SAT 16:00')
    expect(formatScheduleTime('2026-09-12T14:00:00Z', 'local', '02:00:00', 'Asia/Tehran')).toBe('SAT 17:30')
  })

  it('rolls into the previous date for a negative track offset', () => {
    expect(formatScheduleTime('2026-11-21T04:00:00Z', 'track', '-08:00:00')).toBe('FRI 20:00')
    expect(formatScheduleDates('2026-11-21T04:00:00Z', '2026-11-23T07:00:00Z', 'track', '-08:00:00')).toBe('NOV 20 — NOV 22')
  })

  it('supports half-hour offsets and midnight without displaying 24:00', () => {
    expect(formatScheduleTime('2026-03-06T20:30:00Z', 'track', '+03:30:00')).toBe('SAT 00:00')
    expect(trackOffsetMinutes('-03:30:00')).toBe(-210)
    expect(trackTimeLabel('05:30:00')).toBe('UTC+05:30')
  })

  it('uses the visitor zone at the event date, including daylight saving', () => {
    expect(formatScheduleTime('2026-03-06T12:00:00Z', 'local', '11:00:00', 'America/New_York')).toBe('FRI 07:00')
    expect(formatScheduleTime('2026-03-13T12:00:00Z', 'local', '08:00:00', 'America/New_York')).toBe('FRI 08:00')
  })

  it('labels a missing offset honestly and falls back to UTC', () => {
    expect(trackOffsetMinutes('')).toBeNull()
    expect(trackOffsetMinutes('02:90:00')).toBeNull()
    expect(trackTimeLabel('')).toBe('UTC · track offset unavailable')
    expect(formatScheduleTime('2026-09-12T14:00:00Z', 'track', '')).toBe('SAT 14:00')
    expect(trackTimeLabel('00:00:00')).toBe('UTC')
  })
})
