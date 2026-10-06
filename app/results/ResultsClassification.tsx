'use client'

import { Fragment, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { formatSessionTime, lastTimedStage, sessionGap, timingValue, teamColor, type ResultRow, type SessionKind } from '@/lib/results-story'
import type { RaceExtras } from '@/lib/results-data'
import { resultStatus } from '@/lib/openf1-normalize'
import { DriverPortrait } from './ResultsPodium'
import RaceTrace from './RaceTrace'

export default function ResultsClassification({ rows, kind, extras, published, sprintQualifying }: {
  rows: ResultRow[]; kind: SessionKind; extras: RaceExtras | null; published: boolean; sprintQualifying: boolean
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const qualifying = kind === 'qualifying'
  const race = kind === 'race'
  const columns = qualifying ? 6 : race ? 7 : 5
  const q = sprintQualifying ? 'SQ' : 'Q'
  const stageBests = [0, 1, 2].map((i) => Math.min(...rows.map((r) => timingValue(r.detail?.duration ?? null, i)).filter((v): v is number => v !== null && v > 0)))
  return (
    <section className="results-classification" aria-labelledby="the-field">
      <div className="results-classification-heading"><h2 id="the-field">THE CLASSIFICATION</h2><span className="results-caption">{published ? 'PUBLISHED RESULTS' : 'LATEST TIMING ORDER'}</span></div>
      <p className="results-note">{qualifying ? 'Every stage. Every thousandth.' : race ? 'Select a driver to explore their race.' : 'Best laps and running completed.'}{!published && ' Final results are not yet available.'}</p>
      <div className="results-table-scroll" role="region" aria-label="Session classification" tabIndex={0} data-scroll-x>
        <table className={`results-table results-table--${kind}`}>
          <caption className="sr-only">{kind === 'race' ? 'Race' : kind === 'qualifying' ? 'Qualifying' : 'Practice'} classification, ordered by position</caption>
          <thead><tr><th scope="col">POS</th><th scope="col">DRIVER</th>
            {qualifying ? <>{[0, 1, 2].map((i) => <th key={i} scope="col">{q}{i + 1}</th>)}<th scope="col">LAPS</th></> : <>
              <th scope="col">{race ? 'TIME / GAP' : 'BEST LAP'}</th>
              {!race && <th scope="col">GAP</th>}
              <th scope="col" className="results-optional-col">LAPS</th>
              {race && <><th scope="col" className="results-optional-col">STOPS</th><th scope="col">PTS</th><th scope="col"><span className="sr-only">Race detail</span></th></>}
            </>}
          </tr></thead>
          <tbody>{rows.map((row) => {
            const detail = row.detail
            const open = row.driver_number === expanded
            const out = detail && resultStatus(detail) !== 'classified' ? resultStatus(detail) : null
            const stage = lastTimedStage(detail)
            const pitCount = extras?.stops?.filter((p) => p.driver_number === row.driver_number).length
            return <Fragment key={row.driver_number}>
              <tr className={`${open ? 'is-expanded' : ''} ${row.position === 1 ? 'is-first' : ''}`} style={{ '--driver-color': teamColor(row.driver) } as CSSProperties}>
                <td className="results-table-position">{row.position ? String(row.position).padStart(2, '0') : out ?? 'NC'}</td>
                <th scope="row" className="results-table-driver">
                  <div className="results-driver-cell"><div className="results-table-portrait"><DriverPortrait row={row} /></div><div>
                    {race ? <button type="button" onClick={() => setExpanded(open ? null : row.driver_number)} aria-expanded={open} aria-controls={`result-detail-${row.driver_number}`} aria-label={`${row.driver.full_name}, race detail`}>
                      {row.driver.last_name || row.driver.full_name}
                    </button> : row.driver.name_acronym ? <Link href={`/drivers/${row.driver.name_acronym.toLowerCase()}`} prefetch={false}>{row.driver.last_name || row.driver.full_name}</Link> : row.driver.full_name}
                    <span className="results-table-team">{row.driver.team_name || `#${row.driver_number}`}{out ? ` · ${out}` : qualifying && stage !== null ? ` · ${q}${stage + 1}` : ''}</span>
                  </div></div>
                </th>
                {qualifying ? <>{[0, 1, 2].map((i) => {
                  const lap = timingValue(detail?.duration ?? null, i)
                  return <td key={i} className={lap !== null && lap === stageBests[i] ? 'results-best-lap' : ''}>
                    <span>{formatSessionTime(lap)}</span>{lap !== null && lap > 0 && <small>{lap === stageBests[i] ? 'FASTEST' : sessionGap(detail, kind, i)}</small>}
                  </td>
                })}<td>{detail?.number_of_laps ?? '—'}</td></> : <>
                  <td className="results-table-time">{race ? out ?? (row.position === 1 ? formatSessionTime(timingValue(detail?.duration ?? null)) : sessionGap(detail, kind)) : formatSessionTime(timingValue(detail?.duration ?? null))}</td>
                  {!race && <td>{sessionGap(detail, kind)}</td>}
                  <td className="results-optional-col">{detail?.number_of_laps ?? '—'}</td>
                  {race && <><td className="results-optional-col">{pitCount ?? '—'}</td><td className="results-table-points">{detail && detail.points_available !== false ? detail.points : '—'}</td><td><button type="button" className="results-expand" aria-label={`${open ? 'Close' : 'Open'} ${row.driver.full_name} race detail`} aria-expanded={open} aria-controls={`result-detail-${row.driver_number}`} onClick={() => setExpanded(open ? null : row.driver_number)}>{open ? '−' : '+'}</button></td></>}
                </>}
              </tr>
              {race && <tr id={`result-detail-${row.driver_number}`} hidden={!open} className="results-detail-row"><td colSpan={columns}>
                {open && <div className="results-driver-detail">
                  <div className="results-detail-intro"><h3>{row.driver.full_name}</h3><p>{detail?.number_of_laps != null ? `${detail.number_of_laps} laps` : 'Lap count unavailable'} · {pitCount == null ? 'Pit stops unavailable' : `${pitCount} pit ${pitCount === 1 ? 'stop' : 'stops'}`}</p>
                    {row.driver.name_acronym && <Link href={`/drivers/${row.driver.name_acronym.toLowerCase()}`} prefetch={false}>DRIVER PROFILE ↗</Link>}
                  </div><RaceTrace row={row} extras={extras} />
                </div>}
              </td></tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div>
      {qualifying && <p className="results-table-footnote">Gaps are relative to the fastest lap in each stage. A blank time means no time was recorded.</p>}
    </section>
  )
}
