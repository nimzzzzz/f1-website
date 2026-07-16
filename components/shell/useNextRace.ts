'use client'

import { useEffect, useState } from 'react'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import {
  getRaceMeetings,
  getCurrentMeeting,
  getNextMeeting,
  CANCELLED_COUNTRIES,
} from '@/lib/openf1'

export interface NextRaceInfo {
  meeting: Meeting
  raceStart: Date | null
  round: number
  totalRounds: number
  isLive: boolean
  seasonYear: number
}

// Shared shell data: current/next race + season metadata for the top-bar
// ticker and the menu footer. Uses the same client cache as the pages, so
// this costs no extra network beyond the app's existing fetches.
export function useNextRace(): NextRaceInfo | null {
  const [info, setInfo] = useState<NextRaceInfo | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([meetings, sessions]: [Meeting[], Session[]]) => {
        if (!alive) return
        const active = meetings.filter((m) => !CANCELLED_COUNTRIES.has(m.country_name))
        const current = getCurrentMeeting(active)
        const target = current ?? getNextMeeting(active)
        if (!target) return
        const raceMeetings = getRaceMeetings(meetings).sort(
          (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
        )
        const race = sessions.find(
          (s) => s.meeting_key === target.meeting_key && s.session_name === 'Race'
        )
        setInfo({
          meeting: target,
          raceStart: race ? new Date(race.date_start) : new Date(target.date_start),
          round: raceMeetings.findIndex((m) => m.meeting_key === target.meeting_key) + 1,
          totalRounds: raceMeetings.length,
          isLive: current !== null,
          seasonYear: target.year,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return info
}

export function shortRaceName(meeting: Meeting): string {
  return meeting.meeting_name.replace(/grand prix/i, 'GP').toUpperCase()
}
