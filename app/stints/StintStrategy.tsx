'use client'
import Image from 'next/image'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { COMPOUNDS, compoundMix, compoundUsage, stintAtLap, tyreAge, type Compound, type StrategyDriver, type StrategyStint } from '@/lib/stint-story'
import { driverImage } from '@/lib/media-manifest'
import { focusSessionSection } from '@/lib/session-experience'
import { usePlayback } from '@/components/session/usePlayback'

const lapLabel = (s: StrategyStint) => `L${s.start ?? '?'}–${s.end ?? '?'}`
export default function StintStrategy({ drivers, stints }: { drivers: StrategyDriver[]; stints: StrategyStint[] }) {
  const maxLap = Math.max(1, ...stints.flatMap(s => [s.start ?? 0, s.end ?? 0]))
  const [lap, setLap] = useState(1)
  const [driverNumber, setDriverNumber] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('name')
  const driver = drivers.find(d => d.number === driverNumber) ?? drivers[0]
  const selected = driver ? stintAtLap(driver, lap) : null
  const mix = useMemo(() => compoundMix(drivers, lap), [drivers, lap])
  const usage = useMemo(() => compoundUsage(stints), [stints])
  const playback = usePlayback(lap, 1, maxLap, setLap)
  const title = useRef<HTMLHeadingElement>(null)
  const compound = selected?.compound ?? 'UNKNOWN'
  const age = tyreAge(selected, lap)
  const portrait = driver ? driverImage(driver.acronym) : null
  let sum = 0
  const stops = (Object.keys(COMPOUNDS) as Compound[]).flatMap(c => {
    const start = sum; sum += mix.counts[c] / Math.max(1, drivers.length) * 100
    return mix.counts[c] ? [`${COMPOUNDS[c].color} ${start}% ${sum}%`] : []
  })
  stops.push(`#303030 ${sum}% 100%`)
  const filtered = drivers.filter(d => `${d.name} ${d.team} ${d.number}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => order === 'runs' ? b.stints.length - a.stints.length || a.number - b.number : a.surname.localeCompare(b.surname))
  const choose = (d: StrategyDriver, stint?: StrategyStint, scroll = false) => {
    playback.stop(); setDriverNumber(d.number)
    if (stint?.start !== null && stint?.start !== undefined) setLap(stint.start)
    if (scroll) requestAnimationFrame(() => focusSessionSection(title.current))
  }
  if (!driver) return null
  return <>
    <section className="st-hero" aria-labelledby="st-hero-title">
      <div className="st-intro"><h2 id="st-hero-title" ref={title} tabIndex={-1}>THE LONG GAME.</h2><p className="ws-copy">One field. Different choices. Move through the laps and follow each driver’s tyre story.</p></div>
      <div className="st-instruments">
        <div className="st-field">
          <div className="st-ring" style={{ '--st-mix': `conic-gradient(${stops.join(',')})` } as CSSProperties} aria-hidden>
            <div className="st-ring-center"><span>LAP</span><strong>{String(lap).padStart(2, '0')}</strong><small>OF {maxLap} RECORDED</small></div>
          </div>
          <div className="st-mix" aria-label={`Compound distribution at lap ${lap}`}>
            {(Object.keys(COMPOUNDS) as Compound[]).filter(c => mix.counts[c]).map(c => <span key={c}><i style={{ background: COMPOUNDS[c].color }} aria-hidden /><b>{mix.counts[c]}</b>{c}</span>)}
            <span className="st-coverage">{mix.covered}/{drivers.length} drivers have a recorded range at this lap.</span>
          </div>
        </div>
        <div className="st-driver" style={{ '--st-color': COMPOUNDS[compound].color } as CSSProperties}>
          <label className="ws-field st-follow"><span className="ws-label">FOLLOW A DRIVER</span><select value={driver.number} onChange={e => { setDriverNumber(Number(e.target.value)); playback.stop() }}>{drivers.map(d => <option key={d.number} value={d.number}>{d.number} · {d.name}</option>)}</select></label>
          <div className="st-driver-name">{portrait && <span className="st-portrait"><Image src={portrait} alt="" fill unoptimized /></span>}<div><h3>{driver.surname}</h3><p>{driver.team} · #{driver.number}</p></div></div>
          <div className="st-compound-readout" key={compound}><span className="st-compound-letter">{COMPOUNDS[compound].letter}</span><div><strong>{selected ? compound : 'NO RECORDED RANGE'}</strong><span>{selected ? `STINT ${selected.stint} · ${lapLabel(selected)}` : 'Choose a recorded stint below'}</span></div></div>
          <dl className="st-readings"><div><dt>TYRE AGE AT LAP START</dt><dd>{age ?? 'N/A'}{age !== null && <small>LAPS</small>}</dd></div><div><dt>RECORDED STINT LENGTH</dt><dd>{selected?.length ?? 'N/A'}{selected?.length !== null && selected && <small>LAPS</small>}</dd></div></dl>
          <div className="st-driver-runs" aria-label={`${driver.name} recorded stints`}>{driver.stints.map(s => <button key={s.key} type="button" onClick={() => choose(driver, s)} aria-pressed={selected?.key === s.key} disabled={s.start === null}><i style={{ borderColor: COMPOUNDS[s.compound].color }} aria-hidden>{COMPOUNDS[s.compound].letter}</i><span>STINT {s.stint}<small>{lapLabel(s)}</small></span></button>)}</div>
        </div>
      </div>
      <div className="st-scrubber"><button type="button" className="ws-button" onClick={playback.toggle} disabled={playback.reduced || maxLap <= 1}>{playback.reduced ? 'MOTION REDUCED' : playback.playing ? 'PAUSE' : lap >= maxLap ? 'REPLAY LAPS' : 'PLAY LAPS'}<span aria-hidden>{playback.playing ? 'II' : '→'}</span></button><label><span className="ws-label">EXPLORE LAP {lap}</span><input type="range" min={1} max={maxLap} value={lap} aria-valuetext={`Lap ${lap} of ${maxLap}`} onChange={e => { playback.stop(); setLap(Number(e.target.value)) }} /></label><span className="st-lap-total">{String(lap).padStart(2, '0')}<small> / {maxLap}</small></span></div>
    </section>
    <section className="st-board" aria-labelledby="st-board-title">
      <h2 id="st-board-title" className="ws-heading">THE STRATEGY WALL.</h2><p className="ws-copy">Every stint on the same lap scale. Select a coloured run to inspect it above.</p>
      <div className="st-board-tools"><label className="ws-field"><span className="ws-label">FIND A DRIVER OR TEAM</span><input type="search" value={query} placeholder="Name, team or car number" onChange={e => setQuery(e.target.value)} /></label><label className="ws-field"><span className="ws-label">ORDER</span><select value={order} onChange={e => setOrder(e.target.value)}><option value="name">Driver name</option><option value="runs">Most recorded stints</option></select></label><p className="ws-label" role="status">{filtered.length} OF {drivers.length} DRIVERS</p></div>
      <div className="ws-scroll" data-scroll-x tabIndex={0} role="region" aria-label="Driver stint timeline, scroll horizontally on small screens">
        <div className="st-timeline">
          <div className="st-axis"><span className="ws-label">DRIVER</span><div>{[...new Set([0,.25,.5,.75,1].map(p => Math.round(1+(maxLap-1)*p)))].map(tick => <span key={tick} style={{ left: `${(tick-.5)/maxLap*100}%` }}>{tick}</span>)}</div><span className="ws-label">AT L{lap}</span></div>
          {filtered.map(d => {
            const current = stintAtLap(d, lap)
            return <div key={d.number} className={`st-row${d.number === driver.number ? ' is-selected' : ''}`}>
              <button type="button" className="st-driver-button" aria-pressed={d.number === driver.number} onClick={() => choose(d, undefined, true)}><i style={{ background:d.color }} aria-hidden /><span>{d.acronym}<small>{d.surname}</small></span></button>
              <div className="st-track"><div className="st-cursor" style={{ left:`${(lap-.5)/maxLap*100}%` }} aria-hidden />{d.stints.map(s => s.start !== null && s.end !== null ? <button key={s.key} className={`st-run${selected?.key === s.key ? ' is-selected' : ''}`} style={{ left:`${(s.start-1)/maxLap*100}%`,width:`${s.length!/maxLap*100}%`,'--st-color':COMPOUNDS[s.compound].color } as CSSProperties} type="button" title={`${d.name} · ${s.compound} · ${lapLabel(s)} · ${s.length} laps`} onClick={() => choose(d,s,true)} aria-label={`${COMPOUNDS[s.compound].letter}, ${d.name}, stint ${s.stint}, ${s.compound}, laps ${s.start} to ${s.end}`}><span aria-hidden>{s.length! / maxLap > .045 ? COMPOUNDS[s.compound].letter : ''}</span></button> : null)}</div>
              <span className="st-at-lap" style={{ color:current ? COMPOUNDS[current.compound].color : '#aaa' }}>{current ? `${COMPOUNDS[current.compound].letter} · ${tyreAge(current,lap) ?? '?'}L` : 'N/A'}</span>
            </div>
          })}
        </div>
      </div>
      {!filtered.length && <p className="ws-note">No drivers match this search.</p>}
      <p className="ws-note st-board-note">Gaps mean no recorded range. Overlapping ranges are treated as uncertain. Open-ended stints remain in each driver’s selector; their length is not invented. Driver order is not a race classification.</p>
    </section>
    <section className="st-compound-section" aria-labelledby="st-compounds-title"><h2 id="st-compounds-title" className="ws-heading">HOW FAR DID THEY GO?</h2><p className="ws-copy">Recorded usage across the field. Stint length is not a measurement of tyre wear.</p><div className="st-usage">{usage.map(u => <article key={u.compound} style={{ '--st-color':COMPOUNDS[u.compound].color } as CSSProperties}><div className="st-usage-heading"><span>{COMPOUNDS[u.compound].letter}</span><h3>{u.compound}</h3></div><strong>{u.longest ?? 'N/A'}<small>LONGEST RUN · LAPS</small></strong><dl><div><dt>STINTS</dt><dd>{u.count}</dd></div><div><dt>RECORDED DRIVER-LAPS</dt><dd>{u.laps}</dd></div></dl>{u.timed < u.count && <p className="ws-note">{u.count-u.timed} incomplete {u.count-u.timed === 1 ? 'range' : 'ranges'}</p>}</article>)}</div></section>
    <p className="ws-note ws-source">Source: <a href="https://openf1.org/docs/#stints" target="_blank" rel="noreferrer">OpenF1 stint records ↗</a>. Tyre age is the recorded starting age plus completed laps in that stint. A compound name is relative to the event; this feed does not identify its C-number.</p>
  </>
}
