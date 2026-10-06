import type { Lineup, SquadScore } from '@/lib/fantasy/types'
import type { Ticket } from '@/lib/predictions/game'
export type Game = 'fantasy' | 'predictions'
export interface Weekend { id: string; season: number; round: number; name: string; locks_at: string; race_at: string; roster: {id:string; first:string; surname:string; team:string; price:number}[]; budget:number; status:'open'|'final'|'cancelled'; result_version:number }
export interface LiveEntry { weekend_id:string; game:Game; payload: {lineup:Lineup} | Ticket; updated_at:string }
export interface LiveScore { player_id:string; weekend_id:string; points:number; bonus:number; leader:number; breakdown:SquadScore | unknown }
export interface LeagueMember {player_id:string; joined_at:string}
export function liveCup(weekends: Weekend[], members: LeagueMember[], scores: LiveScore[], cupNumber: number, now: number) {
  const firstRound = (cupNumber - 1) * 4 + 1
  const first = weekends.find(w => w.round === firstRound)
  if (!first || now < Date.parse(first.locks_at)) return null
  const totals = new Map<string, number>()
  for (const s of scores) if (weekends.some(w => w.id === s.weekend_id && w.round < firstRound && w.status === 'final')) totals.set(s.player_id, (totals.get(s.player_id) ?? 0) + s.points)
  const seeds = members.filter(m => Date.parse(m.joined_at) < Date.parse(first.locks_at)).sort((a,b) => (totals.get(b.player_id) ?? 0) - (totals.get(a.player_id) ?? 0) || a.joined_at.localeCompare(b.joined_at) || a.player_id.localeCompare(b.player_id)).slice(0,16).map(m=>m.player_id)
  if (seeds.length < 2) return { number:cupNumber, seeds, stages:[], champion:null }
  let participants: (string|null)[] = [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11].map(n=>seeds[n-1]??null)
  const stages: {round:number; a:string|null; b:string|null; pointsA:number|null; pointsB:number|null; winner:string|null; bye:boolean; tiebreak:boolean; cancelled:boolean}[][] = []
  for(let stage=0;stage<4;stage++) {
    const round = firstRound + stage, w = weekends.find(r=>r.round===round)
    const resolved = w?.status==='final' || w?.status==='cancelled'
    const matches = Array.from({length:participants.length/2},(_,i)=>{
      const a=participants[i*2], b=participants[i*2+1]
      const sa=w?.status==='cancelled'?undefined:scores.find(s=>s.player_id===a && s.weekend_id===w?.id), sb=w?.status==='cancelled'?undefined:scores.find(s=>s.player_id===b && s.weekend_id===w?.id)
      const pointsA=resolved ? sa?.points??0 : null, pointsB=resolved ? sb?.points??0 : null
      const delta=(pointsA??0)-(pointsB??0) || (sa?.bonus??0)-(sb?.bonus??0) || (sa?.leader??0)-(sb?.leader??0)
      const winner=resolved ? (!a ? b : !b ? a : delta>0 ? a : delta<0 ? b : seeds.indexOf(a)<seeds.indexOf(b) ? a : b) : null
      return {round,a,b,pointsA,pointsB,winner,bye:Boolean(a)!==Boolean(b),tiebreak: Boolean(resolved && a && b && pointsA===pointsB),cancelled:w?.status==='cancelled'}
    })
    stages.push(matches); participants=matches.map(m=>m.winner)
    if(!resolved) break
  }
  return {number:cupNumber,seeds,stages,champion:stages.length===4 ? stages[3][0].winner : null}
}
