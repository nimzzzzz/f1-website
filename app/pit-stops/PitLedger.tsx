'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { pitTime, type PitMetric, type PitVisit } from '@/lib/pit-story'
import type { Stint } from '@/lib/openf1'
import type { PitWindow } from './PitTraffic'
import PitTyres from './PitTyres'
import { focusPitSection } from './pit-scroll'

const PAGE_SIZE = 20
export default function PitLedger({ visits, metric, window, selected, stints, onInspect, onClearWindow }: {
  visits: PitVisit[]; metric: PitMetric; window: PitWindow | null; selected: string; stints: Stint[] | null;
  onInspect: (visit: PitVisit) => void; onClearWindow: () => void;
}) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('race')
  const [page, setPage] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => setPage(0), [window?.start, window?.end, metric])
  const filtered = useMemo(() => visits.filter(v =>
    (!window || (v.lap !== null && v.lap >= window.start && v.lap <= window.end)) &&
    `${v.name} ${v.acronym} ${v.number} ${v.team}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => order === 'quick' ? (a[metric] ?? Infinity) - (b[metric] ?? Infinity) || (a.lap ?? Infinity) - (b.lap ?? Infinity) : 0), [visits, window, query, order, metric])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const changePage = (next: number) => { setPage(next); focusPitSection(heading.current) }
  return <section className="pit-ledger" aria-labelledby="pit-ledger-title">
    <div className="pit-ledger-heading"><div className="pit-section-heading"><h2 ref={heading} tabIndex={-1} id="pit-ledger-title">EVERY VISIT. EVERY SECOND.</h2><p>Inspect any visit in the pit-lane replay above.</p></div><span className="pit-ledger-count">{String(filtered.length).padStart(2, '0')}<small>VISITS</small></span></div>
    <div className="pit-ledger-filters"><label><span className="pit-label">FIND A DRIVER OR TEAM</span><input type="search" placeholder="Name, team or car number" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /></label>
      <label><span className="pit-label">ORDER</span><select value={order} onChange={e => { setOrder(e.target.value); setPage(0) }}><option value="race">Race order</option><option value="quick">{metric === 'stationary' ? 'Quickest stationary' : 'Quickest pit lane'}</option></select></label>
      <div className="pit-ledger-filter-state"><span className="pit-label" role="status">{filtered.length} OF {visits.length} VISITS{window ? ` · LAPS ${window.start}–${window.end}` : ''}</span>{(query || window) && <button className="pit-action" type="button" onClick={() => { setQuery(''); setPage(0); onClearWindow() }}>CLEAR FILTERS<span aria-hidden>×</span></button>}</div>
    </div>
    {shown.length ? <div className="pit-ledger-scroll" data-lenis-prevent tabIndex={0} role="region" aria-label="All pit visits, scroll horizontally for all columns">
      <table className="pit-table"><caption className="sr-only">Recorded pit visits. Stationary and total pit-lane times are separate measurements.</caption><thead><tr><th scope="col">LAP</th><th scope="col">DRIVER / VISIT</th><th scope="col">TYRES</th><th scope="col">STATIONARY</th><th scope="col">PIT LANE</th><th scope="col"><span className="sr-only">Inspect visit</span></th></tr></thead>
        <tbody>{shown.map(v => <tr key={v.key} className={selected === v.key ? 'is-selected' : ''}>
          <td className="pit-table-lap">{v.lap === null ? 'N/A' : String(v.lap).padStart(2, '0')}</td>
          <th scope="row"><span className="pit-table-driver"><i style={{ background: v.color }} aria-hidden /><span><strong>{v.surname}</strong><small>{v.team} · {v.ordinal}/{v.total}</small></span></span></th>
          <td><PitTyres visit={v} stints={stints} /></td>
          <td className={metric === 'stationary' ? 'pit-active-time' : ''}>{pitTime(v.stationary)}</td><td className={metric === 'lane' ? 'pit-active-time' : ''}>{pitTime(v.lane)}</td>
          <td><button type="button" className="pit-inspect" aria-pressed={selected === v.key} aria-label={`Inspect ${v.name}, visit ${v.ordinal}, lap ${v.lap ?? 'unavailable'}`} onClick={() => onInspect(v)}>INSPECT<span aria-hidden>↗</span></button></td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="pit-empty">No visits match these filters. Try another name or show all laps.</p>}
    <div className="pit-pagination"><button type="button" className="pit-action" disabled={current === 0} onClick={() => changePage(current - 1)}>PREVIOUS</button><span>{filtered.length ? `${current * PAGE_SIZE + 1}–${Math.min((current + 1) * PAGE_SIZE, filtered.length)} OF ${filtered.length}` : '0 VISITS'}</span><button type="button" className="pit-action" disabled={current >= pages - 1} onClick={() => changePage(current + 1)}>NEXT<span aria-hidden>↗</span></button></div>
  </section>
}
