'use client'

import Image from 'next/image'
import { useState } from 'react'
import { driverImage } from '@/lib/media-manifest'
import { CALL_INFO, PREDICTION_DRIVERS, type DriverCall, type Ticket } from '@/lib/predictions/game'
import GameDialog from '@/components/games/GameDialog'

export function PredictionPortrait({ id, eager = false }: { id: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false)
  const src = driverImage(id)
  return <span className="prediction-portrait" aria-hidden>{src && !broken ? <Image src={src} alt="" width={1336} height={3840} unoptimized loading={eager ? 'eager' : 'lazy'} onError={() => setBroken(true)} /> : <span>{id}</span>}</span>
}

export default function PredictionPicker({ call, ticket, onPick, onClose }: { call: DriverCall; ticket: Ticket; onPick: (id: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const drivers = PREDICTION_DRIVERS.filter(d => `${d.first} ${d.name} ${d.team}`.toLowerCase().includes(search.toLowerCase().trim()))
  return <GameDialog title={`Call it: ${CALL_INFO[call].label}`} onClose={onClose} className="predictions-dialog predictions-dialog--wide">
    <p className="predictions-dialog-copy">{CALL_INFO[call].description} Podium picks must be different; choosing an existing podium driver swaps their position.</p>
    <label className="predictions-search"><span className="sr-only">Search drivers or teams</span><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a driver or team" /></label>
    <p className="predictions-picker-count" aria-live="polite">{drivers.length} drivers in the practice grid</p>
    <div className="predictions-picker-grid">{drivers.map(driver => <button key={driver.id} className={ticket.picks[call] === driver.id ? 'is-picked' : ''} onClick={() => onPick(driver.id)}>
      <PredictionPortrait key={driver.id} id={driver.id} />
      <span><small>{driver.first}</small><strong>{driver.name}</strong><small>{driver.team}</small></span><span className="predictions-picker-indicator" aria-hidden>{ticket.picks[call] === driver.id ? 'Selected' : '+'}</span>
    </button>)}</div>
    {drivers.length === 0 && <p className="predictions-empty">No drivers match. Try another name or team.</p>}
  </GameDialog>
}
