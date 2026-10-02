'use client'

import type { ReactNode } from 'react'
import { useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import type { DataState } from '@/lib/fetch-result'
import { writeSessionUrl } from '@/lib/session-experience'
import SessionHeader from './SessionHeader'
import DataStateNotice from './DataStateNotice'
import LiveBeat from './LiveBeat'
import './workspace.css'

type Feed = {
  dataKey: number | null; state: DataState; message: string | null; stale: boolean; fetching: boolean;
  live: boolean; liveFlowing: boolean; lastUpdateAt: number | null; refresh: () => void;
}
export default function SessionWorkspace({ title, ghost, className, list, feed, count, empty, children }: {
  title: string; ghost: string; className: string; list: ReturnType<typeof useSessionList>; feed: Feed;
  count: number; empty: string; children: ReactNode;
}) {
  if (list.loading) return <div className={`ws-page ${className}`}><h1 className="sr-only" data-loading-h1>{title}</h1><p className="ws-label">LOADING SESSIONS…</p><div className="ws-skeleton" aria-hidden /></div>
  const different = feed.dataKey !== null && feed.dataKey !== list.selectedKey
  const retained = different ? sessionStripLabel(list.sessions.find(s => s.session_key === feed.dataKey)) : null
  return <div className={`ws-page ${className}`}>
    <SessionHeader kicker={title} ghost={ghost} sessions={list.sessions} selectedKey={list.selectedKey}
      onSelect={key => { list.setSelectedKey(key); writeSessionUrl(key) }}
      live={<LiveBeat live={feed.live} flowing={feed.liveFlowing} updatedAt={feed.lastUpdateAt} message={feed.message} />} />
    <DataStateNotice state={list.state === 'unavailable' ? list.state : feed.state} message={list.message ?? feed.message} stale={feed.stale} staleLabel={retained}
      onRetry={list.state === 'unavailable' ? () => window.location.reload() : feed.refresh} emptyLabel={list.selectedKey ? empty : 'SELECT A SESSION'} className="mt-8" />
    {different && !feed.stale && count > 0 && <p className="ws-notice" role="status">LOADING SELECTED SESSION · SHOWING {retained}</p>}
    {count > 0 ? children : feed.fetching ? <div className="ws-skeleton" role="status"><span className="sr-only">Loading {title.toLowerCase()}</span></div> : <div className="ws-empty-mark" aria-hidden>AWAITING<br />THE SIGNAL.</div>}
  </div>
}
