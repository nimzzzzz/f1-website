'use client'

import { useMemo, useRef, useState } from 'react'
import type { Driver, Lap } from '@/lib/openf1'
import type { LapContext } from '@/lib/laps-data'
import { lapKey, lapTime, pitOnLap, positive, sectors, sectorTime, timedLaps, type LapDriver } from '@/lib/laps-story'
import { Tyre } from './LapIdentity'
import { focusTimingSection } from './laps-scroll'

const PAGE_SIZE = 30
type Sort = 'lap' | 'fastest' | 'latest'

export default function LapExplorer({ laps, drivers, roster, context, onUse }: {
  laps: Lap[]; drivers: LapDriver[]; roster: Driver[]; context: LapContext | null; onUse: (slot: number, lap: Lap) => void;
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('lap')
  const [includeOut, setIncludeOut] = useState(() => timedLaps(laps).length === 0)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const driverMap = useMemo(() => new Map(roster.map((d) => [d.driver_number, d])), [roster])
  const numbers = useMemo(() => [...new Set(laps.map((l) => l.driver_number))].sort((a, b) => a - b), [laps])
  const result = useMemo(() => {
    const query = search.trim().toLowerCase()
    return laps.filter((l) => {
      const d = driverMap.get(l.driver_number)
      return (filter === 'all' || String(l.driver_number) === filter) && (includeOut || (!l.is_pit_out_lap && positive(l.lap_duration))) &&
        (!query || `${d?.full_name ?? ''} ${d?.name_acronym ?? ''} ${d?.team_name ?? ''} ${l.driver_number}`.toLowerCase().includes(query))
    }).sort((a, b) => sort === 'fastest' ? (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity) || a.lap_number - b.lap_number : sort === 'latest' ? b.lap_number - a.lap_number || a.driver_number - b.driver_number : a.lap_number - b.lap_number || a.driver_number - b.driver_number)
  }, [laps, driverMap, filter, includeOut, search, sort])
  const pageCount = Math.max(1, Math.ceil(result.length / PAGE_SIZE)), current = Math.min(page, pageCount - 1)
  const displayed = result.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const changePage = (n: number) => { setPage(n); setExpanded(null); focusTimingSection(heading.current) }
  return <section className="laps-explorer" aria-labelledby="laps-explorer-title">
    <div className="laps-section-heading"><h2 ref={heading} tabIndex={-1} id="laps-explorer-title">EVERY LAP, IN DETAIL.</h2><p>The complete lap log. Open any row for its sector breakdown.</p></div>
    <div className="laps-explorer-filters">
      <label><span className="laps-caption">FIND A DRIVER OR TEAM</span><input type="search" value={search} placeholder="Name, team or number" onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></label>
      <label><span className="laps-caption">DRIVER</span><select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}><option value="all">All drivers</option>{numbers.map((n) => <option key={n} value={n}>{driverMap.get(n)?.full_name || `Driver ${n}`}</option>)}</select></label>
      <label><span className="laps-caption">SORT BY</span><select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0) }}><option value="lap">Lap number</option><option value="fastest">Fastest first</option><option value="latest">Highest lap number</option></select></label>
    </div>
    <div className="laps-explorer-summary"><span role="status">{result.length} {result.length === 1 ? 'LAP' : 'LAPS'} FOUND</span><label className="laps-toggle"><input type="checkbox" checked={includeOut} onChange={(e) => { setIncludeOut(e.target.checked); setPage(0) }} /> INCLUDE OUT / UNTIMED LAPS</label></div>
    <div className="laps-log">
      {displayed.length === 0 ? <p className="laps-empty">No laps match these filters. Try another driver or include out laps.</p> : displayed.map((lap) => {
        const key = lapKey(lap), open = key === expanded, d = driverMap.get(lap.driver_number)
        const driver = drivers.find((item) => item.number === lap.driver_number)
        const best = driver?.best.lap_number === lap.lap_number
        return <div key={key} className={`laps-log-entry${open ? ' is-open' : ''}`}>
          <button type="button" className="laps-log-row" aria-expanded={open} aria-controls={`lap-detail-${key}`} onClick={() => setExpanded(open ? null : key)}>
            <span className="laps-log-name"><i style={{ background: driver?.color ?? '#aaa' }} />{d?.name_acronym || `#${lap.driver_number}`}</span><span>L{lap.lap_number}</span>
            <span className="laps-log-state">{lap.is_pit_out_lap ? 'OUT LAP' : !lap.lap_duration ? 'UNTIMED' : pitOnLap(lap, context?.stops ?? null) ? 'PIT STOP' : best ? 'PERSONAL BEST' : ''}</span>
            <strong>{lapTime(lap.lap_duration)}</strong><span className="laps-log-expand" aria-hidden>{open ? '-' : '+'}</span><span className="sr-only">, {d?.full_name || `Driver ${lap.driver_number}`}, sector details</span>
          </button>
          {open && <div className="laps-log-detail" id={`lap-detail-${key}`}>
            <div className="laps-log-detail-heading"><span>{d?.full_name || `Driver ${lap.driver_number}`}</span><Tyre lap={lap} stints={context?.stints ?? null} /></div>
            <dl>{sectors.map((s, i) => <div key={s}><dt>SECTOR {i + 1}</dt><dd>{sectorTime(lap[s])}</dd></div>)}<div><dt>SPEED TRAP</dt><dd>{positive(lap.st_speed) ? `${lap.st_speed} km/h` : 'N/A'}</dd></div></dl>
            {positive(lap.lap_duration) && !lap.is_pit_out_lap && <div className="laps-log-actions"><button type="button" className="laps-button" onClick={() => onUse(0, lap)}>USE IN DUEL A <span aria-hidden>↗</span></button>{drivers.length > 1 && <button type="button" className="laps-button" onClick={() => onUse(1, lap)}>USE IN DUEL B <span aria-hidden>↗</span></button>}</div>}
          </div>}
        </div>
      })}
    </div>
    <div className="laps-pagination"><button type="button" className="laps-button" disabled={current === 0} onClick={() => changePage(current - 1)}>PREVIOUS</button><span>{current + 1} / {pageCount}</span><button type="button" className="laps-button" disabled={current === pageCount - 1} onClick={() => changePage(current + 1)}>NEXT</button></div>
  </section>
}
