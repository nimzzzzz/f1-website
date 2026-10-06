import { scoreSquad } from '@/lib/fantasy/rules'
import { ROLES, type DriverResult, type Lineup } from '@/lib/fantasy/types'
import { scoreTicket, type Ticket, type Outcome } from '@/lib/predictions/game'
import type { Weekend, Game } from './competition'

export interface FinalResult { confirmedFinal: true; source: string; safetyCar: boolean; drivers: DriverResult[] }
export function validateWeekend(value: unknown): asserts value is Omit<Weekend,'id'|'status'|'result_version'> {
  const w=value as Weekend
  if(!w || !Number.isInteger(w.season) || w.season<2026 || w.season>2100 || !Number.isInteger(w.round) || w.round<1 || w.round>30 || typeof w.name!=='string' || !w.name.trim()) throw new Error('Invalid weekend identity')
  if(![w.locks_at,w.race_at].every(t=>typeof t==='string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(t))) throw new Error('Include an explicit UTC offset on both deadlines')
  if(!Number.isFinite(Date.parse(w.locks_at)) || !Number.isFinite(Date.parse(w.race_at)) || Date.parse(w.race_at)<=Date.parse(w.locks_at)) throw new Error('Grand Prix qualifying must precede the race')
  if(!Number.isSafeInteger(w.budget) || w.budget<=0 || !Array.isArray(w.roster) || w.roster.length<3 || w.roster.length>30) throw new Error('Invalid roster or budget')
  if(new Set(w.roster.map(d=>d.id)).size!==w.roster.length || w.roster.some(d=>!d || !/^[A-Z0-9_]{2,12}$/.test(d.id) || typeof d.surname!=='string' || !d.surname || typeof d.team!=='string' || !d.team || typeof d.first!=='string' || !Number.isSafeInteger(d.price) || d.price<=0)) throw new Error('Invalid driver, duplicate id or missing price')
  if([...w.roster].sort((a,b)=>a.price-b.price).slice(0,3).reduce((n,d)=>n+d.price,0)>w.budget) throw new Error('No legal three-driver squad fits this budget')
}
export function validateFinalResult(value: unknown, weekend: Weekend): asserts value is FinalResult {
  const r=value as FinalResult
  if(!r || r.confirmedFinal!==true || typeof r.safetyCar!=='boolean' || !Array.isArray(r.drivers)) throw new Error('Final results and full safety-car status must be explicitly confirmed')
  const source=new URL(r.source); if(source.protocol!=='https:') throw new Error('An HTTPS source URL is required')
  if(r.drivers.length!==weekend.roster.length || new Set(r.drivers.map(d=>d.driverId)).size!==r.drivers.length) throw new Error('One result required for every eligible driver, including DNS')
  const pos=(n:unknown)=>n===null || typeof n==='number' && Number.isInteger(n) && n>0 && n<=weekend.roster.length
  for(const d of r.drivers) {
    if(!weekend.roster.some(p=>p.id===d.driverId && p.team===d.team) || !['finished','dnf','dns','dsq'].includes(d.status) || !pos(d.qualifying) || !pos(d.grid) || !pos(d.finish) || (d.status==='finished' && d.finish===null)) throw new Error('Driver result does not match the published roster or classification')
  }
  for(const field of ['qualifying','grid','finish'] as const) {
    const values=r.drivers.map(d=>d[field]).filter(n=>n!==null)
    if(new Set(values).size!==values.length) throw new Error(`Duplicate ${field} positions`)
  }
  if(!r.drivers.some(d=>d.qualifying===1) || [1,2,3].some(p=>!r.drivers.some(d=>d.finish===p && d.status==='finished'))) throw new Error('Pole and a complete podium are required')
  if(r.drivers.some(d=>d.status==='finished' && d.grid===null)) throw new Error('A verified starting position is required for each finisher before biggest-mover scoring')
}
export function officialOutcome(result: FinalResult): Outcome {
  const finishers=result.drivers.filter(d=>d.status==='finished' && d.finish!==null && d.grid!==null)
  const largest=Math.max(...finishers.map(d=>d.grid! - d.finish!))
  return {pole:result.drivers.find(d=>d.qualifying===1)!.driverId,podium:[1,2,3].map(p=>result.drivers.find(d=>d.finish===p && d.status==='finished')!.driverId) as [string,string,string],movers:finishers.filter(d=>d.grid! - d.finish! === largest).map(d=>d.driverId),safety:result.safetyCar}
}
export function scoreOfficialEntries(weekend: Weekend, entries: {player_id:string;game:Game;payload:unknown}[], result: unknown) {
  validateFinalResult(result,weekend)
  const outcome=officialOutcome(result),ids=weekend.roster.map(d=>d.id)
  return entries.map(entry=>{
    if(entry.game==='predictions') {
      const score=scoreTicket(entry.payload as Ticket,outcome,ids)
      return {player_id:entry.player_id,game:entry.game,points:score.total,bonus:score.bonus,leader:0,breakdown:score}
    }
    const lineup=(entry.payload as {lineup:Lineup})?.lineup
    if(!lineup || ROLES.some(r=>!ids.includes(lineup[r])) || new Set(ROLES.map(r=>lineup[r])).size!==3) throw new Error('Invalid fantasy entry')
    const score=scoreSquad(lineup,result.drivers)
    return {player_id:entry.player_id,game:entry.game,points:score.total,bonus:score.bonus,leader:score.leader,breakdown:score}
  })
}
