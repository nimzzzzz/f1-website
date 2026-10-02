'use client'
import { useMemo } from 'react'
import { getCachedWeather } from '@/lib/client-cache'
import { useSessionData, useSessionList } from '@/lib/use-session-data'
import { POLL_SLOW } from '@/lib/session-live'
import { availableSession, initialSession } from '@/lib/session-experience'
import { weatherReadings } from '@/lib/weather-story'
import SessionWorkspace from '@/components/session/SessionWorkspace'
import WeatherStation from './WeatherStation'
import './weather.css'
export default function WeatherClient() {
  const list = useSessionList(availableSession, initialSession)
  const session = list.sessions.find(s=>s.session_key===list.selectedKey) ?? null
  const feed = useSessionData(list.selectedKey,{weather:getCachedWeather},{pollMs:{weather:POLL_SLOW},session})
  const rows = useMemo(()=>weatherReadings(feed.data?.weather??[],feed.dataKey??-1),[feed.data,feed.dataKey])
  return <SessionWorkspace title="WEATHER" ghost="WX" className="wx-page" list={list} feed={feed} count={rows.length} empty="NO WEATHER READINGS FOR THIS SESSION">
    <WeatherStation key={feed.dataKey} rows={rows}/>
  </SessionWorkspace>
}
