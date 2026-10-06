import { describe,expect,it } from 'vitest'
import { fantasyCareer,raceDuel } from '@/lib/fantasy/career'
import { DEFAULT_SAVE,playRound } from '@/lib/fantasy/practice'
import { predictionInsights } from '@/lib/predictions/insights'
import { INITIAL_PREDICTIONS,predictionOutcome,type PredictionSave,type Ticket } from '@/lib/predictions/game'

describe('earned career history',()=>{
 it('starts with no earned trophies, milestones or invented chart points',()=>{
  const f=fantasyCareer(DEFAULT_SAVE)
  expect(f.history).toEqual([]);expect(f.trophies).toEqual([]);expect(f.achievements.every(a=>a.round===null)).toBe(true)
  const p=predictionInsights(INITIAL_PREDICTIONS)
  expect(p.categories.every(c=>c.percent===null)).toBe(true);expect(p.milestones.every(m=>m.round===null)).toBe(true)
 })
 it('reconstructs original role contributions and preserves old debriefs after lineup edits',()=>{
  let save=DEFAULT_SAVE
  for(let i=0;i<5;i++)save=playRound(save)
  const before=JSON.stringify(save),duel=raceDuel(save,1)!
  expect(duel.you.drivers.reduce((n,d,i)=>n+d.total-duel.opponentScore.drivers[i].total,0)).toBe(duel.difference)
  const edited={...save,team:{...save.team,lineup:{leader:'ALB',charger:'NOR',rival:'GAS'}}}
  expect(raceDuel(edited,1)?.you).toEqual(duel.you)
  expect(fantasyCareer(save).history).toHaveLength(5)
  expect(JSON.stringify(save)).toBe(before)
 })
 it('counts exact accuracy separately from partial podium points and ignores unrevealed tickets',()=>{
  const outcome=predictionOutcome(1)
  const ticket:Ticket={picks:{pole:outcome.pole,first:outcome.podium[1],second:outcome.podium[0],third:outcome.podium[2],mover:outcome.movers[0],safety:outcome.safety?'yes':'no'},boost:'first'}
  const save:PredictionSave={...INITIAL_PREDICTIONS,entries:[{round:1,ticket,revealed:true},{round:2,ticket,revealed:false}]}
  const insight=predictionInsights(save)
  expect(insight.weekends).toHaveLength(1)
  expect(insight.categories.find(c=>c.call==='first')).toMatchObject({exact:0,partial:1,percent:0,points:10})
  expect(insight.milestones.find(m=>m.name==='Podium oracle')?.round).toBeNull()
  expect(insight.milestones.find(m=>m.name==='Backed the winner')?.round).toBeNull()
  expect(insight.currentStreak).toBe(1);expect(insight.boostPaid).toBe(1)
 })
})
