'use client'
import { useMemo } from 'react'
import { getCachedRaceControl } from '@/lib/client-cache'
import { useSessionData, useSessionList } from '@/lib/use-session-data'
import { POLL_FAST } from '@/lib/session-live'
import { availableSession, initialSession } from '@/lib/session-experience'
import { controlMessages } from '@/lib/control-story'
import SessionWorkspace from '@/components/session/SessionWorkspace'
import ControlRoom from './ControlRoom'
import './race-control.css'
export default function RaceControlClient() {
  const list=useSessionList(availableSession,initialSession)
  const session=list.sessions.find(s=>s.session_key===list.selectedKey)??null
  const feed=useSessionData(list.selectedKey,{messages:getCachedRaceControl},{pollMs:{messages:POLL_FAST},session})
  const rows=useMemo(()=>controlMessages(feed.data?.messages??[],feed.dataKey??-1),[feed.data,feed.dataKey])
  return <SessionWorkspace title="RACE CONTROL" ghost="RC" className="rc-page" list={list} feed={feed} count={rows.length} empty="NO RACE CONTROL MESSAGES FOR THIS SESSION">
    <ControlRoom key={feed.dataKey} messages={rows}/>
  </SessionWorkspace>
}
