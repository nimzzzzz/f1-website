'use client'

import type { Stint } from '@/lib/openf1'
import { lapTime, sectors, sectorTime, type LapDriver } from '@/lib/laps-story'
import { LapPortrait, Tyre } from './LapIdentity'

export default function LapLeaderboard({ drivers, selected, onSelect, stints }: {
  drivers: LapDriver[]; selected: number; onSelect: (driver: LapDriver) => void; stints: Stint[] | null;
}) {
  const best = drivers[0]?.best.lap_duration ?? 0
  const sectorBests = sectors.map((key) => Math.min(...drivers.map((d) => d.best[key] ?? Infinity)))
  return <section className="laps-leaderboard" aria-labelledby="laps-best-title">
    <div className="laps-section-heading"><h2 id="laps-best-title">ONE LAP. EVERY DRIVER.</h2><p>Each driver&apos;s quickest recorded lap. Choose a name to load their best into Duel A.</p></div>
    <div className="laps-table-wrap" tabIndex={0} role="region" aria-label="Best lap leaderboard, scroll horizontally for sector times" data-scroll-x>
      <table className="laps-table laps-best-table">
        <caption className="sr-only">Best recorded lap per driver, fastest first</caption>
        <thead><tr><th scope="col">POS</th><th scope="col">DRIVER</th><th scope="col">BEST LAP</th><th scope="col">GAP</th><th scope="col" className="laps-tyre-col">TYRE AT LAP START</th>{sectors.map((_, i) => <th scope="col" key={i}>S{i + 1}</th>)}</tr></thead>
        <tbody>{drivers.map((d, i) => <tr key={d.number} className={d.number === selected ? 'is-selected' : ''}>
          <td>{String(i + 1).padStart(2, '0')}</td><th scope="row"><button type="button" onClick={() => onSelect(d)} aria-pressed={d.number === selected}><LapPortrait driver={d} small /><span><strong>{d.surname}</strong><small>{d.team}</small></span><i style={{ background: d.color }} /><span className="sr-only">Load best lap in Duel A</span></button></th>
          <td><strong>{lapTime(d.best.lap_duration)}</strong><small>LAP {d.best.lap_number}</small></td><td>{i === 0 ? 'FASTEST' : `+${(d.best.lap_duration - best).toFixed(3)}`}</td><td className="laps-tyre-col"><Tyre lap={d.best} stints={stints} /></td>
          {sectors.map((key, j) => <td key={key} className={d.best[key] === sectorBests[j] ? 'laps-best-sector' : ''}>{sectorTime(d.best[key])}{d.best[key] === sectorBests[j] && <span className="sr-only">, fastest in this table</span>}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="laps-note">Highlighted sectors are quickest among the laps in this table. Lap-feed timings may include laps later deleted.</p>
  </section>
}
