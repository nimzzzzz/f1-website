import { describe,expect,it } from 'vitest'
import { liveCup,type Weekend } from '@/lib/games/competition'
import { validateWeekend,validateFinalResult,scoreOfficialEntries,type FinalResult } from '@/lib/games/scoring'
const roster=['NEW','ALT','THR'].map((id,i)=>({id,first:'Driver',surname:id,team:`Team ${i}`,price:200}))
const weekend:Weekend={id:'one',season:2026,round:1,name:'Real race',locks_at:'2026-10-01T12:00:00Z',race_at:'2026-10-02T12:00:00Z',roster,budget:600,status:'final',result_version:1}
const result:FinalResult={confirmedFinal:true,source:'https://www.fia.com/event-results',safetyCar:true,drivers:roster.map((d,i)=>({driverId:d.id,team:d.team,qualifying:i+1,grid:3-i,finish:i+1,status:'finished'}))}
describe('real competitions',()=>{
 it('uses the published roster, including substitutes outside the practice roster',()=>{
  const scores=scoreOfficialEntries(weekend,[{player_id:'p',game:'predictions',payload:{picks:{pole:'NEW',first:'NEW',second:'ALT',third:'THR',mover:'NEW',safety:'yes'},boost:'first'}}],result)
  expect(scores[0].points).toBe(105)
 })
 it('refuses incomplete or ambiguous classifications and impossible published budgets',()=>{
  expect(()=>validateFinalResult({...result,confirmedFinal:false},weekend)).toThrow()
  expect(()=>validateFinalResult({...result,drivers:result.drivers.slice(0,2)},weekend)).toThrow()
  expect(()=>validateFinalResult({...result,drivers:result.drivers.map(d=>({...d,qualifying:1}))},weekend)).toThrow('Duplicate')
  expect(()=>validateWeekend({...weekend,budget:500})).toThrow('budget')
  expect(()=>validateWeekend({...weekend,locks_at:weekend.race_at})).toThrow('qualifying')
 })
 it('locks cup membership, never resolves an unfinished weekend, and applies tiebreaks deterministically',()=>{
  const members=Array.from({length:16},(_,i)=>({player_id:`p${i}`,joined_at:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`}))
  members.push({player_id:'late',joined_at:'2026-10-02T12:00:00Z'})
  const rounds=[1,2,3,4].map(round=>({...weekend,id:`r${round}`,round,status:(round===1?'final':'open') as Weekend['status']}))
  expect(liveCup(rounds,members,[],1,Date.parse('2026-09-30'))).toBeNull()
  const scores=[{player_id:'p0',weekend_id:'r1',points:20,bonus:1,leader:10,breakdown:{}},{player_id:'p15',weekend_id:'r1',points:20,bonus:2,leader:10,breakdown:{}}]
  const cup=liveCup(rounds,members,scores,1,Date.parse('2026-10-03'))!
  expect(cup.seeds).not.toContain('late');expect(cup.stages[0][0]).toMatchObject({winner:'p15',tiebreak:true})
  expect(cup.stages).toHaveLength(2);expect(cup.stages[1].every(m=>m.winner===null)).toBe(true);expect(cup.champion).toBeNull()
  const cancelled=liveCup(rounds.map(w=>w.round===1?{...w,status:'cancelled' as const}:w),members,scores,1,Date.parse('2026-10-03'))!
  expect(cancelled.stages[0][0].winner).toBe('p0')
 })
})
