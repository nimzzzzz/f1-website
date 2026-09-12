import type { Session } from './openf1'

/** Keep cancelled and neighbouring weekends out of the hero's session clock. */
export function weekendSessions(sessions: Session[], meetingKey: number): Session[] {
  return sessions
    .filter((s) => s.meeting_key === meetingKey && !s.is_cancelled)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))
}

export function weekendState(sessions: Session[], now: number) {
  const active = sessions.filter((s) => !s.is_cancelled)
  return {
    live: active.find((s) => Date.parse(s.date_start) <= now && now < Date.parse(s.date_end)) ?? null,
    next: active.filter((s) => Date.parse(s.date_start) > now)
      .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null,
  }
}

export function countdownParts(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000))
  return [Math.floor(seconds / 86400), Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
}
