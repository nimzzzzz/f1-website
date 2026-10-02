'use client'
import { useMemo, useRef, useState } from 'react'
import { compassPoint, nearestWeather, weatherBounds, weatherPath, weatherRange, weatherValue as fmt, type WeatherReading } from '@/lib/weather-story'
import { utcTime, focusSessionSection } from '@/lib/session-experience'
import { usePlayback } from '@/components/session/usePlayback'

export default function WeatherStation({rows}:{rows:WeatherReading[]}) {
  const [sample,setSample] = useState(-1)
  const [page,setPage] = useState(0)
  const current = sample < 0 ? rows.length-1 : Math.min(sample,rows.length-1)
  const reading = rows[current]
  const playback = usePlayback(current,0,rows.length-1,setSample,180)
  const title = useRef<HTMLHeadingElement>(null)
  const logTitle = useRef<HTMLHeadingElement>(null)
  const bounds = useMemo(()=>weatherBounds(rows),[rows])
  const paths = useMemo(()=>({track:weatherPath(rows,'track',bounds.min,bounds.max),air:weatherPath(rows,'air',bounds.min,bounds.max)}),[rows,bounds])
  const ranges = useMemo(()=>({track:weatherRange(rows,'track'),air:weatherRange(rows,'air'),wind:weatherRange(rows,'wind')}),[rows])
  if (!reading) return null
  const from = rows[0].time, span = Math.max(1,rows.at(-1)!.time-from)
  const x = 50+(reading.time-from)/span*800
  const thermalGap = reading.track !== null && reading.air !== null ? reading.track-reading.air : null
  const pages = Math.ceil(rows.length/20), currentPage = Math.min(page,pages-1)
  const display = [...rows].reverse().slice(currentPage*20,(currentPage+1)*20)
  const choose = (index:number,scroll=false) => { playback.stop();setSample(index);if(scroll)requestAnimationFrame(()=>focusSessionSection(title.current)) }
  return <>
    <section className="wx-station" aria-labelledby="wx-title">
      <div className="wx-title-row"><h2 ref={title} tabIndex={-1} id="wx-title">READ THE<br />CONDITIONS.</h2><div className="wx-observation"><span className="ws-label">{sample < 0 ? 'LATEST RECORDED' : 'SELECTED READING'}</span><strong>{utcTime(reading.time,true)}</strong><span className="ws-label">UTC · {new Date(reading.time).toISOString().slice(0,10)}</span></div></div>
      <div className="wx-main">
        <div className="wx-thermal"><span className="ws-label">TRACK TEMPERATURE</span><div className="wx-temperature">{fmt(reading.track)}<small>{reading.track!==null?'°C':''}</small></div><div className="wx-thermal-baseline"><div><span className="ws-label">AIR TEMPERATURE</span><strong>{fmt(reading.air)}{reading.air!==null&&<small>°C</small>}</strong></div><div><span className="ws-label">TRACK / AIR DIFFERENCE</span><strong>{thermalGap===null?'N/A':`${thermalGap>0?'+':''}${fmt(thermalGap)}`}{thermalGap!==null&&<small>°C</small>}</strong></div></div>
          <div className={`wx-rain-state${reading.rain===true?' is-raining':''}`}><span className="wx-rain-mark" aria-hidden /><span>{reading.rain===null?'RAINFALL NOT REPORTED':reading.rain?'RAIN DETECTED':'NO RAIN DETECTED'}<small>OBSERVATION AT {utcTime(reading.time)} UTC</small></span></div>
        </div>
        <div className="wx-wind">
          <div className="wx-compass" role="img" aria-label={`Wind ${fmt(reading.wind)} metres per second, reported direction ${reading.direction===null?'unavailable':`${reading.direction} degrees, ${compassPoint(reading.direction)}`}`}>
            <svg viewBox="0 0 300 300" aria-hidden><circle cx="150" cy="150" r="125" fill="none" stroke="#454545"/><circle cx="150" cy="150" r="91" fill="none" stroke="#292929"/>{Array.from({length:72},(_,i)=><line key={i} x1="150" y1={i%6===0?25:30} x2="150" y2={i%6===0?40:34} stroke={i%6===0?'#aaa':'#555'} transform={`rotate(${i*5} 150 150)`}/>)}{reading.direction!==null&&<g className="wx-needle" style={{transform:`rotate(${reading.direction}deg)`}}><path d="M150 37 L143 57 L150 52 L157 57 Z" fill="#e9e9e5"/><line x1="150" y1="56" x2="150" y2="77" stroke="#e9e9e5" strokeWidth="2"/></g>}</svg>
            <span className="wx-n">N</span><span className="wx-e">E</span><span className="wx-s">S</span><span className="wx-w">W</span><div className="wx-wind-reading"><span>WIND SPEED</span><strong>{fmt(reading.wind)}</strong><small>M/S</small></div>
          </div>
          <div className="wx-direction"><strong>{compassPoint(reading.direction)}</strong><span>{reading.direction===null?'DIRECTION NOT REPORTED':`${reading.direction}° · REPORTED DIRECTION`}</span></div>
        </div>
      </div>
      <div className="wx-atmosphere"><div><span className="ws-label">RELATIVE HUMIDITY</span><strong>{fmt(reading.humidity,0)}<small>{reading.humidity!==null?'%':''}</small></strong><span className="wx-humidity" aria-hidden><i style={{width:`${reading.humidity??0}%`}}/></span></div><div><span className="ws-label">AIR PRESSURE</span><strong>{fmt(reading.pressure)}<small>{reading.pressure!==null?'MBAR':''}</small></strong></div><div><span className="ws-label">SESSION READINGS</span><strong>{rows.length}<small>RECORDED</small></strong></div></div>
    </section>
    <section className="wx-history" aria-labelledby="wx-history-title"><h2 id="wx-history-title" className="ws-heading">A SESSION IN DEGREES.</h2><p className="ws-copy">Explore the temperature trace. Every reading also updates the instruments above.</p>
      <div className="wx-chart-key"><span><i className="wx-track-key"/>TRACK</span><span><i className="wx-air-key"/>AIR</span><span>°C · TIMES IN UTC</span></div>
      <div className="wx-chart" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();choose(nearestWeather(rows,((e.clientX-rect.left)/rect.width*900-50)/800))}}>
        <svg viewBox="0 0 900 270" role="img" aria-label={`Track and air temperature from ${utcTime(from)} to ${utcTime(rows.at(-1)!.time)} UTC. Use the reading slider below for exact values.`}>
          {[0,.25,.5,.75,1].map(p=><g key={p}><line x1="50" x2="850" y1={225-p*200} y2={225-p*200} stroke="#333"/><text x="36" y={229-p*200} textAnchor="end">{Math.round(bounds.min+p*(bounds.max-bounds.min))}</text></g>)}
          <path className="wx-track-path" d={paths.track} fill="none" stroke="#efa77a" strokeWidth="2.5"/>
          <path d={paths.air} fill="none" stroke="#9bd5e8" strokeWidth="2" strokeDasharray="6 5"/>
          {rows.filter(r=>r.rain===true).map(r=><line key={r.time} x1={50+(r.time-from)/span*800} x2={50+(r.time-from)/span*800} y1="236" y2="242" stroke="#9bd5e8" strokeWidth="3"/>)}
          <line x1={x} x2={x} y1="18" y2="244" stroke="#eee" strokeDasharray="2 4"/>
          {(['air','track'] as const).map(field=>reading[field]!==null&&<circle key={field} cx={x} cy={225-(reading[field]!-bounds.min)/(bounds.max-bounds.min)*200} r="4" fill={field==='air'?'#9bd5e8':'#efa77a'} stroke="#111" strokeWidth="2"/>)}
          {[0,.5,1].map(p=><text key={p} x={50+p*800} y="263" textAnchor={p===0?'start':p===1?'end':'middle'}>{utcTime(from+p*span)}</text>)}
        </svg>
      </div>
      <div className="wx-playback"><button className="ws-button" type="button" onClick={playback.toggle} disabled={playback.reduced||rows.length<2}>{playback.reduced?'MOTION REDUCED':playback.playing?'PAUSE':'REPLAY READINGS'}</button><label><span className="ws-label">READING {current+1} OF {rows.length} · {utcTime(reading.time)} UTC</span><input type="range" min="0" max={rows.length-1} value={current} aria-valuetext={`${utcTime(reading.time)} UTC, track ${fmt(reading.track)} degrees, air ${fmt(reading.air)} degrees`} onChange={e=>choose(Number(e.target.value))}/></label><button className="ws-button" type="button" onClick={()=>{playback.stop();setSample(-1)}} disabled={sample<0}>LATEST</button></div>
      <div className="wx-selected-values"><span>TRACK <strong>{fmt(reading.track)}{reading.track!==null?'°C':''}</strong></span><span>AIR <strong>{fmt(reading.air)}{reading.air!==null?'°C':''}</strong></span><time dateTime={reading.date}>{utcTime(reading.time,true)} UTC</time></div><p className="ws-note">Blue ticks mark readings with rain. Missing temperatures and gaps over three minutes break the trace. These are observations, not a forecast.</p>
      <div className="wx-ranges">{([{key:'track',label:'TRACK RANGE',unit:'°C'},{key:'air',label:'AIR RANGE',unit:'°C'},{key:'wind',label:'WIND RANGE',unit:'M/S'}] as const).map(item=><div key={item.key}><span className="ws-label">{item.label}</span><strong>{ranges[item.key]?`${fmt(ranges[item.key]!.min)} – ${fmt(ranges[item.key]!.max)}`:'N/A'}<small>{ranges[item.key]?item.unit:''}</small></strong></div>)}</div>
    </section>
    <section className="wx-log" aria-labelledby="wx-log-title"><h2 className="ws-heading" id="wx-log-title" ref={logTitle} tabIndex={-1}>THE OBSERVATION LOG.</h2><p className="ws-copy">Every recorded sample, newest first. Select a time to inspect that moment.</p><div className="ws-scroll" data-lenis-prevent tabIndex={0} role="region" aria-label="All weather observations, scroll horizontally for all measurements"><table className="wx-table"><caption className="sr-only">Recorded weather observations, all times in UTC</caption><thead><tr>{['TIME · UTC','TRACK °C','AIR °C','HUMIDITY %','WIND M/S','DIRECTION °','PRESSURE MBAR','RAIN'].map(t=><th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{display.map(r=><tr key={r.time} className={r.time===reading.time?'is-selected':''}><th scope="row"><button type="button" onClick={()=>choose(rows.indexOf(r),true)} aria-pressed={r.time===reading.time}>{utcTime(r.time,true)}<span aria-hidden> ↗</span></button></th><td className="wx-log-track">{fmt(r.track)}</td><td>{fmt(r.air)}</td><td>{fmt(r.humidity,0)}</td><td>{fmt(r.wind)}</td><td>{fmt(r.direction,0)}</td><td>{fmt(r.pressure)}</td><td>{r.rain===null?'N/A':r.rain?'YES':'NO'}</td></tr>)}</tbody></table></div><div className="ws-pagination"><button type="button" className="ws-button" disabled={!currentPage} onClick={()=>{setPage(currentPage-1);focusSessionSection(logTitle.current)}}>PREVIOUS</button><span>{currentPage*20+1}–{Math.min((currentPage+1)*20,rows.length)} OF {rows.length}</span><button type="button" className="ws-button" disabled={currentPage>=pages-1} onClick={()=>{setPage(currentPage+1);focusSessionSection(logTitle.current)}}>NEXT</button></div></section>
    <p className="ws-note ws-source">Source: <a href="https://openf1.org/docs/#weather" target="_blank" rel="noreferrer">OpenF1 track weather ↗</a>. Rainfall is a recorded yes/no observation; it does not measure rain intensity or confirm whether the racing surface is dry. All times are UTC.</p>
  </>
}
