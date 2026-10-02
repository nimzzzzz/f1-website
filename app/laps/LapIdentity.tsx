'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import { driverImage } from '@/lib/media-manifest'
import type { Lap, Stint } from '@/lib/openf1'
import { lapTime, stintAt, tyreAge, type LapDriver, timedLaps } from '@/lib/laps-story'
import DriverPicker from './DriverPicker'

export function Tyre({ lap, stints }: { lap: Lap; stints: Stint[] | null }) {
  const stint = stintAt(lap, stints)
  const compound = stint?.compound?.toUpperCase()
  const known = compound && ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(compound)
  const age = tyreAge(lap, stint)
  return <span className="laps-tyre" title={age !== null ? `${compound}, ${age} laps old at lap start` : undefined}>
    {known && <i aria-hidden className={`laps-compound laps-compound--${compound.toLowerCase()}`}>{compound[0]}</i>}
    <span>{known ? compound : 'TYRE N/A'}{known && age !== null ? ` · ${age}L OLD` : ''}</span>
  </span>
}

export function LapPortrait({ driver, small = false }: { driver: LapDriver; small?: boolean }) {
  const src = driverImage(driver.acronym)
  return <span className={`laps-portrait${small ? ' laps-portrait--small' : ''}`} aria-hidden>
    {/* Serve the official original: resizing the full-body image to the small
        crop's width throws away face detail before CSS zooms it back in. */}
    {src ? <Image src={src} alt="" fill unoptimized loading={small ? 'lazy' : 'eager'} /> : <span>{driver.number}</span>}
  </span>
}

export default function LapIdentity({ slot, driver, lap, drivers, other, onDriver, onLap, stints }: {
  slot: 'A' | 'B'; driver: LapDriver; lap: Lap; drivers: LapDriver[]; other?: number;
  onDriver: (number: number) => void; onLap: (number: number) => void; stints: Stint[] | null;
}) {
  return <div className="laps-identity" style={{ '--lap-color': driver.color } as CSSProperties}>
    <LapPortrait driver={driver} />
    <div className="laps-identity-copy">
      <span className="laps-caption laps-driver-caption"><span className="laps-slot">{slot}</span> SELECT DRIVER</span>
      <DriverPicker slot={slot} driver={driver} drivers={drivers} other={other} onSelect={onDriver} />
      <span className="laps-identity-team">{driver.team}</span>
      <label className="sr-only" htmlFor={`laps-lap-${slot}`}>Lap {slot} for {driver.name}</label>
      <select id={`laps-lap-${slot}`} className="laps-lap-select" value={lap.lap_number} onChange={(e) => onLap(Number(e.target.value))}>
        {timedLaps(driver.laps).map((l) => <option key={l.lap_number} value={l.lap_number}>L{l.lap_number} · {lapTime(l.lap_duration)}</option>)}
      </select>
      <Tyre lap={lap} stints={stints} />
    </div>
  </div>
}
