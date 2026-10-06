'use client'

import { pitWindows, type PitVisit } from '@/lib/pit-story'

export type PitWindow = { start: number; end: number }
export default function PitTraffic({ visits, selected, onSelect }: { visits: PitVisit[]; selected: PitWindow | null; onSelect: (window: PitWindow | null) => void }) {
  const windows = pitWindows(visits)
  if (!windows.length) return null
  const most = Math.max(1, ...windows.map(w => w.visits.length))
  const busiest = windows.find(w => w.visits.length === most)!
  const unplaced = visits.filter(v => v.lap === null).length
  return <section className="pit-traffic" aria-labelledby="pit-traffic-title">
    <div className="pit-section-heading"><h2 id="pit-traffic-title">THE CALL TO BOX.</h2><p>See when the pit lane came alive. Choose a window to explore its visits below.</p></div>
    <div className="pit-traffic-summary"><span className="pit-label">{selected ? `LAPS ${selected.start}–${selected.end} SELECTED` : `BUSIEST WINDOW · LAPS ${busiest.start}–${busiest.end} · ${most} VISITS`}</span>{selected && <button type="button" className="pit-action" onClick={() => onSelect(null)}>SHOW ALL LAPS<span aria-hidden>×</span></button>}</div>
    <div className="pit-window-scroll" data-scroll-x tabIndex={0} role="group" aria-label="Pit activity by lap window, scroll horizontally on small screens">
      <div className="pit-windows" style={{ gridTemplateColumns: `repeat(${windows.length}, minmax(48px, 1fr))` }}>
        {windows.map(w => <button key={w.start} type="button" className={`pit-window${w.visits.length === most ? ' is-busiest' : ''}`}
          disabled={!w.visits.length} aria-pressed={selected?.start === w.start}
          onClick={() => onSelect(selected?.start === w.start ? null : { start: w.start, end: w.end })}>
          <span className="pit-window-plot"><strong>{w.visits.length || ''}<span className="sr-only">{w.visits.length ? '' : '0'} pit {w.visits.length === 1 ? 'visit' : 'visits'}.</span></strong><span className="pit-window-stack" style={{ height: `${Math.max(2, w.visits.length / most * 125)}px` }}>
            {w.visits.map(v => <i key={v.key} style={{ background: v.color }} />)}
          </span></span>
          <span className="pit-window-laps"><span className="sr-only">{w.start === w.end ? 'Lap ' : 'Laps '}</span>{w.start}{w.start !== w.end && <span>–{w.end}</span>}</span>
        </button>)}
      </div>
    </div>
    <div className="pit-traffic-foot"><span>Each segment is one recorded visit.{unplaced > 0 && ` ${unplaced} ${unplaced === 1 ? 'visit has' : 'visits have'} no lap number and cannot be plotted.`}</span><span>LAPS 1–{windows.at(-1)!.end} · THROUGH LAST RECORDED VISIT</span></div>
  </section>
}
