'use client'
import { useMemo } from 'react'
import { getCachedStints, getCachedDrivers } from '@/lib/client-cache'
import { useSessionData, useSessionList } from '@/lib/use-session-data'
import { POLL_SLOW } from '@/lib/session-live'
import { availableSession, initialRaceSession } from '@/lib/session-experience'
import { strategyDrivers, strategyStints } from '@/lib/stint-story'
import SessionWorkspace from '@/components/session/SessionWorkspace'
import StintStrategy from './StintStrategy'
import './stints.css'
export default function StintsClient() {
  const list = useSessionList(availableSession, initialRaceSession)
  const session = list.sessions.find(s => s.session_key === list.selectedKey) ?? null
  const feed = useSessionData(list.selectedKey, { stints: getCachedStints, drivers: getCachedDrivers }, {
    primary: 'stints', optional: ['drivers'], pollMs: { stints: POLL_SLOW }, session,
  })
  const stints = useMemo(() => strategyStints(feed.data?.stints ?? [], feed.dataKey ?? -1), [feed.data, feed.dataKey])
  const drivers = useMemo(() => strategyDrivers(stints, feed.data?.drivers ?? [], feed.dataKey ?? -1), [stints, feed.data, feed.dataKey])
  return <SessionWorkspace title="TYRES & STINTS" ghost="TYRE" className="st-page" list={list} feed={feed} count={stints.length} empty="NO STINT DATA FOR THIS SESSION">
    <StintStrategy key={feed.dataKey} drivers={drivers} stints={stints} />
  </SessionWorkspace>
}
