'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { driverImage } from '@/lib/media-manifest'
import { PRACTICE_DRIVERS } from '@/lib/fantasy/practice'
import { BUDGET, ROLE_INFO, assignDriver, lineupCost, money } from '@/lib/fantasy/rules'
import { ROLES, type FantasyDriver, type Lineup, type Role } from '@/lib/fantasy/types'
import FantasyDialog from './FantasyDialog'

export function DriverPortrait({ driver, priority = false }: { driver: FantasyDriver; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = driverImage(driver.id)
  return <span className="fantasy-portrait" aria-hidden>
    {src && !failed ? <Image key={src} src={src} alt="" width={1336} height={3840} unoptimized
      loading={priority ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <span className="fantasy-portrait-fallback">{driver.number}</span>}
  </span>
}

export default function DriverMarket({ role, lineup, onChoose, onClose }: {
  role: Role; lineup: Lineup; onChoose: (id: string) => void; onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [affordable, setAffordable] = useState(false)
  const [sort, setSort] = useState('price-desc')
  const drivers = useMemo(() => PRACTICE_DRIVERS.filter(d => `${d.first} ${d.surname} ${d.team}`.toLowerCase().includes(search.toLowerCase().trim()))
    .filter(d => !affordable || lineupCost(assignDriver(lineup, role, d.id), PRACTICE_DRIVERS) <= BUDGET)
    .sort((a, b) => sort === 'name' ? a.surname.localeCompare(b.surname) : sort === 'price-asc' ? a.price - b.price : b.price - a.price), [search, affordable, sort, lineup, role])
  return <FantasyDialog title={`Choose your ${ROLE_INFO[role].name.toLowerCase()}`} onClose={onClose} wide>
    <p className="fantasy-dialog-copy">{ROLE_INFO[role].rule} Choosing a squad member swaps their role.</p>
    <div className="fantasy-market-tools">
      <label className="fantasy-search"><span className="sr-only">Search drivers or teams</span><input autoFocus placeholder="Search drivers or teams" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label><span className="sr-only">Sort drivers</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="price-desc">Price: high to low</option><option value="price-asc">Price: low to high</option><option value="name">Surname</option></select></label>
      <label className="fantasy-checkbox"><input type="checkbox" checked={affordable} onChange={e => setAffordable(e.target.checked)} /> Within budget</label>
    </div>
    <p className="fantasy-market-count" aria-live="polite">{drivers.length} drivers <span>Practice prices</span></p>
    <div className="fantasy-market-list">
      {drivers.map(driver => {
        const current = lineup[role] === driver.id
        const otherRole = ROLES.find(r => r !== role && lineup[r] === driver.id)
        const cost = lineupCost(assignDriver(lineup, role, driver.id), PRACTICE_DRIVERS)
        const over = cost > BUDGET
        return <button key={driver.id} className={`fantasy-market-row${current ? ' is-selected' : ''}`} onClick={() => onChoose(driver.id)} disabled={over}>
          <DriverPortrait driver={driver} />
          <span className="fantasy-market-name"><small>{driver.first}</small><strong>{driver.surname}</strong><span>{driver.team}</span></span>
          <span className="fantasy-market-price"><strong>{money(driver.price)}</strong><small>{over ? `${money(cost - BUDGET)} over budget` : current ? 'Selected' : otherRole ? `Swap ${ROLE_INFO[otherRole].short}` : `${money(BUDGET - cost)} left`}</small></span>
          <span className="fantasy-market-action" aria-hidden>{current ? '' : otherRole ? '↔' : '+'}</span>
        </button>
      })}
      {drivers.length === 0 && <p className="fantasy-empty">No drivers match. Try another name or turn off the budget filter.</p>}
    </div>
  </FantasyDialog>
}
