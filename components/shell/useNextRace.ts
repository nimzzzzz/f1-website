'use client'

import { useEffect, useState } from 'react'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import {
  getRaceMeetings,
  getCurrentMeeting,
  getNextMeeting,
  isCancelled,
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
      .then(([mtgRes, sessionRes]) => {
        // The shell ticker keeps whatever it last showed rather than
        // clearing itself on a failed fetch.
        if (!alive || !mtgRes.ok || !sessionRes.ok) return
        const meetings = mtgRes.rows
        const sessions = sessionRes.rows
        const active = meetings.filter((m) => !isCancelled(m))
        const current = getCurrentMeeting(active)
        const target = current ?? getNextMeeting(active)
        if (!target) return
        // Scored rounds only — cancelled entries are acknowledged on the
        // calendar but never numbered. The shell ticker, the NOW section and
        // the season strip all read from this same rule, so they cannot
        // print different round numbers for the same weekend.
        const raceMeetings = getRaceMeetings(meetings)
          .filter((m) => !isCancelled(m))
          .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
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
