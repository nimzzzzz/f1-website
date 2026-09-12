export type ScheduleTimeMode = 'local' | 'track'

// OpenF1 supplies the offset for each session, including half-hour zones.
// Shift the instant once, then format in UTC so the visitor's zone cannot
// get applied a second time. Missing track offsets are explicitly UTC.
export function trackOffsetMinutes(offset: string): number | null {
  const match = /^([+-]?)(\d{2}):(\d{2})(?::00)?$/.exec(offset)
  if (!match || Number(match[2]) > 14 || Number(match[3]) > 59) return null
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
}

export function trackTimeLabel(offset: string): string {
  const minutes = trackOffsetMinutes(offset)
  if (minutes === null) return 'UTC · track offset unavailable'
  if (minutes === 0) return 'UTC'
  const absolute = Math.abs(minutes)
  return `UTC${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

function clock(date: string, mode: ScheduleTimeMode, offset: string, localZone?: string) {
  return {
    date: new Date(Date.parse(date) + (mode === 'track' ? (trackOffsetMinutes(offset) ?? 0) * 60_000 : 0)),
    timeZone: mode === 'track' ? 'UTC' : localZone,
  }
}

export function formatScheduleTime(date: string, mode: ScheduleTimeMode, offset: string, localZone?: string) {
  const value = clock(date, mode, offset, localZone)
  const day = value.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: value.timeZone })
  const time = value.date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: value.timeZone,
  })
  return `${day.toUpperCase()} ${time}`
}

export function formatScheduleDates(start: string, end: string, mode: ScheduleTimeMode, offset: string, localZone?: string) {
  const format = (date: string) => {
    const value = clock(date, mode, offset, localZone)
    return value.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: value.timeZone }).toUpperCase()
  }
  return `${format(start)} — ${format(end)}`
}
