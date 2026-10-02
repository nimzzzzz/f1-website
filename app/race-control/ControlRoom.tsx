'use client'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { CONTROL_CATEGORIES, controlDeployments, controlScope, controlSignal, featuredControl, nearestControl, type ControlCategory, type ControlMessage } from '@/lib/control-story'
import { focusSessionSection, utcTime } from '@/lib/session-experience'

const colors:Record<ControlCategory,string> = {Flags:'#e8cb5f','Safety car':'#efae77',DRS:'#70d8a2',Decisions:'#d8b0ee',Session:'#eee',Other:'#aaa'}
export default function ControlRoom({messages}:{messages:ControlMessage[]}) {
  const [selected,setSelected]=useState<string|null>(null)
  const [filter,setFilter]=useState<ControlCategory|'All'>('All')
  const [query,setQuery]=useState('')
  const [order,setOrder]=useState('newest')
  const [page,setPage]=useState(0)
  const title=useRef<HTMLHeadingElement>(null),feedTitle=useRef<HTMLHeadingElement>(null)
  const message=messages.find(m=>m.key===selected)??featuredControl(messages)
  const counts=useMemo(()=>Object.fromEntries(CONTROL_CATEGORIES.map(c=>[c,messages.filter(m=>m.group===c).length])) as Record<ControlCategory,number>,[messages])
  const known=useMemo(()=>messages.filter(m=>m.time!==null),[messages])
  const filtered=useMemo(()=>{
    const rows=messages.filter(m=>(filter==='All'||m.group===filter)&&`${m.message} ${m.flag??''} ${m.driver_number??''} ${m.group} ${controlScope(m)}`.toLowerCase().includes(query.trim().toLowerCase()))
    return order==='newest'?rows.reverse():rows
  },[messages,filter,query,order])
  if(!message)return null
  const signal=controlSignal(message),index=messages.indexOf(message),pages=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pages-1)
  const isTrackCall=message.scope?.toLowerCase()==='track'||message.group==='Safety car'||message.group==='Session'
  const from=known[0]?.time??0,span=Math.max(1,(known.at(-1)?.time??from)-from)
  const choose=(m:ControlMessage,scroll=false)=>{setSelected(m.key);if(scroll)requestAnimationFrame(()=>focusSessionSection(title.current))}
  const displayed=filtered.slice(currentPage*20,(currentPage+1)*20)
  return <>
    <section className="rc-room" aria-labelledby="rc-title">
      <div className="rc-intro"><h2 id="rc-title" ref={title} tabIndex={-1}>FROM THE<br />CONTROL ROOM.</h2><p className="ws-copy">Flags. Decisions. Turning points. Follow the calls that shaped the session.</p></div>
      <div className="rc-transmission" style={{'--rc-signal':signal.color} as CSSProperties}>
        <div className="rc-signal-panel" data-pattern={signal.pattern} key={`${signal.label}-${signal.pattern}`}><div className="rc-signal-field" aria-hidden/><span className="rc-signal-category">{message.group.toUpperCase()}</span><strong>{signal.label}</strong><span className="rc-signal-scope">{controlScope(message)}</span></div>
        <div className="rc-message-panel"><div className="rc-message-top"><span className="ws-label">{selected?'SELECTED MESSAGE':isTrackCall?'LATEST TRACK / SESSION CALL':'LATEST RECORDED MESSAGE'}</span><span className="ws-label">{String(index+1).padStart(3,'0')} / {messages.length}</span></div><p className="rc-message-text" key={message.key}>{message.message}</p><dl className="rc-message-meta"><div><dt>TIME · UTC</dt><dd>{message.time===null?'N/A':utcTime(message.time,true)}</dd></div><div><dt>LAP</dt><dd>{message.lap_number??'N/A'}</dd></div><div><dt>REPORTED SCOPE</dt><dd>{controlScope(message)}</dd></div></dl><p className="ws-note">A recorded message at this time, not a reconstruction of the current track state.</p></div>
      </div>
      <div className="rc-message-controls"><div className="ws-actions"><button type="button" className="ws-button" disabled={index<=0} onClick={()=>choose(messages[index-1])}>PREVIOUS CALL</button><button type="button" className="ws-button" disabled={index>=messages.length-1} onClick={()=>choose(messages[index+1])}>NEXT CALL</button></div><button type="button" className="ws-button" onClick={()=>setSelected(null)} disabled={selected===null}>LATEST TRACK CALL</button></div>
      <div className="rc-census"><div><strong>{messages.length}</strong><span>RECORDED MESSAGES</span></div><div><strong>{counts.Flags}</strong><span>FLAG MESSAGES</span></div><div><strong>{controlDeployments(messages)}</strong><span>SC / VSC DEPLOYMENT CALLS</span></div></div>
    </section>
    <section className="rc-sequence" aria-labelledby="rc-sequence-title"><h2 className="ws-heading" id="rc-sequence-title">THE SESSION, INTERRUPTED.</h2><p className="ws-copy">Each mark is a message. Explore the sequence to see the original call.</p>
      {known.length>0&&<div className="rc-event-map" data-lenis-prevent tabIndex={0} role="region" aria-label="Message timeline, scroll horizontally on small screens" onClick={e=>{const rect=e.currentTarget.querySelector('svg')!.getBoundingClientRect();const lane=Math.round(((e.clientY-rect.top)/rect.height*210-18)/27);const group=CONTROL_CATEGORIES[lane];const m=nearestControl(messages,((e.clientX-rect.left)/rect.width*1000-100)/880,group);if(m)choose(m)}}><svg viewBox="0 0 1000 210" role="img" aria-label="Race control message timeline by category. Use the message slider below to explore each call.">{CONTROL_CATEGORIES.map((c,i)=><g key={c}><text x="0" y={22+i*27}>{c.toUpperCase()}</text><line x1="100" x2="980" y1={18+i*27} y2={18+i*27} stroke="#303030"/>{known.filter(m=>m.group===c).map(m=><line key={m.key} x1={100+(m.time!-from)/span*880} x2={100+(m.time!-from)/span*880} y1={10+i*27} y2={26+i*27} stroke={m.key===message.key?'#fff':colors[c]} strokeWidth={m.key===message.key?4:2} opacity={m.key===message.key?1:.65}/>)}</g>)}{message.time!==null&&<line x1={100+(message.time-from)/span*880} x2={100+(message.time-from)/span*880} y1="0" y2="172" stroke="#eee" strokeDasharray="3 5"/>}{[0,.5,1].map(p=><text key={p} x={100+p*880} y="198" textAnchor={p===0?'start':p===1?'end':'middle'}>{utcTime(from+p*span)} UTC</text>)}</svg></div>}
      <label className="rc-event-slider"><span className="ws-label">EXPLORE MESSAGE {index+1} OF {messages.length}</span><input type="range" min="0" max={messages.length-1} value={index} aria-valuetext={`Message ${index+1}, ${message.time===null?'time unavailable':utcTime(message.time,true)+' UTC'}, ${message.message}`} onChange={e=>choose(messages[Number(e.target.value)])}/></label>
      <div className="rc-selected-line"><span className="ws-label">{message.time===null?'TIME N/A':`${utcTime(message.time,true)} UTC`}</span><p>{message.message}</p><button type="button" className="ws-button" onClick={()=>focusSessionSection(title.current)}>OPEN CALL ↗</button></div>
      <p className="ws-note">Track-sector numbers follow the source feed and can refer to smaller track segments. Local yellows do not imply a track-wide caution.{messages.length>known.length&&` ${messages.length-known.length} messages without valid times are not plotted.`}</p>
    </section>
    <section className="rc-feed" aria-labelledby="rc-feed-title"><h2 className="ws-heading" id="rc-feed-title" ref={feedTitle} tabIndex={-1}>EVERY CALL. ON RECORD.</h2><p className="ws-copy">Search the full feed, or isolate the calls you want to follow.</p>
      <div className="rc-filters" role="group" aria-label="Filter race control messages">{(['All',...CONTROL_CATEGORIES] as const).map(c=><button type="button" key={c} aria-pressed={filter===c} onClick={()=>{setFilter(c);setPage(0)}}>{c.toUpperCase()}<span>{c==='All'?messages.length:counts[c]}</span></button>)}</div>
      <div className="rc-search"><label className="ws-field"><span className="ws-label">SEARCH MESSAGES</span><input type="search" value={query} placeholder="Driver number, flag or message text" onChange={e=>{setQuery(e.target.value);setPage(0)}}/></label><label className="ws-field"><span className="ws-label">ORDER</span><select value={order} onChange={e=>{setOrder(e.target.value);setPage(0)}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><span className="ws-label" role="status">{filtered.length} OF {messages.length} MESSAGES</span></div>
      {displayed.length?<ol className="rc-feed-list">{displayed.map(m=>{const s=controlSignal(m);return <li className={m.key===message.key?'is-selected':''} key={m.key} style={{'--rc-signal':s.color} as CSSProperties}><div className="rc-feed-time"><time dateTime={m.time!==null?m.date:undefined}>{m.time===null?'N/A':utcTime(m.time,true)}</time><span>{m.lap_number!==null?`LAP ${m.lap_number}`:'LAP NOT REPORTED'}</span></div><div className="rc-feed-body"><div className="rc-feed-tags"><strong>{m.flag??m.group.toUpperCase()}</strong><span>{controlScope(m)}</span>{m.driver_number!==null&&m.scope?.toLowerCase()!=='driver'&&<span>CAR {m.driver_number}</span>}</div><p>{m.message}</p></div><button type="button" className="rc-inspect" aria-label={`Inspect message at ${m.time===null?'unknown time':utcTime(m.time,true)}: ${m.message}`} aria-pressed={m.key===message.key} onClick={()=>choose(m,true)}>INSPECT<span aria-hidden>↗</span></button></li>})}</ol>:<p className="ws-note rc-no-results">No messages match these filters.</p>}
      {(query||filter!=='All')&&<button type="button" className="ws-button rc-clear" onClick={()=>{setQuery('');setFilter('All');setPage(0)}}>CLEAR FILTERS</button>}
      <div className="ws-pagination"><button type="button" className="ws-button" disabled={!currentPage} onClick={()=>{setPage(currentPage-1);focusSessionSection(feedTitle.current)}}>PREVIOUS</button><span>{filtered.length?`${currentPage*20+1}–${Math.min((currentPage+1)*20,filtered.length)} OF ${filtered.length}`:'0 MESSAGES'}</span><button type="button" className="ws-button" disabled={currentPage>=pages-1} onClick={()=>{setPage(currentPage+1);focusSessionSection(feedTitle.current)}}>NEXT</button></div>
    </section>
    <p className="ws-note ws-source">Source: <a href="https://openf1.org/docs/#race-control" target="_blank" rel="noreferrer">OpenF1 race control messages ↗</a>. Original message text is preserved. The Decisions filter groups messages mentioning investigations, penalties, track limits and related calls; an investigation is not a penalty. Times are UTC.</p>
  </>
}
