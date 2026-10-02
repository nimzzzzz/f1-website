import type { Session } from './openf1'
import { getLenis } from './lenis-store'

export const availableSession = (s: Session) => !s.is_cancelled
function requestedSession(sessions: Session[]) {
  if (typeof window === 'undefined') return undefined
  const key = new URLSearchParams(window.location.search).get('session')
  return sessions.find(s => String(s.session_key) === key)
}
export const initialSession = (sessions: Session[]) => requestedSession(sessions) ?? sessions.find(s => new Date(s.date_end) < new Date())
export const initialRaceSession = (sessions: Session[]) => requestedSession(sessions) ?? sessions.find(s => s.session_type === 'Race' && new Date(s.date_end) < new Date()) ?? initialSession(sessions)
export function writeSessionUrl(key: number) {
  const url = new URL(window.location.href)
  url.searchParams.set('session', String(key))
  window.history.replaceState(window.history.state, '', url)
}
export const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
export const positiveInteger = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
export function utcTime(date: string | number, seconds = false) {
  const time = new Date(date)
  return Number.isFinite(time.getTime()) ? time.toISOString().slice(11, seconds ? 19 : 16) : 'N/A'
}
export function focusSessionSection(element: HTMLElement | null) {
  if (!element) return
  element.focus({ preventScroll: true })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = getLenis()
  if (lenis) lenis.scrollTo(element, { offset: -95, duration: .65, immediate: reduced })
  else element.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
}
