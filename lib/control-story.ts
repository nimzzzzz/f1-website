import type { RaceControl } from './openf1'
import { positiveInteger } from './session-experience'

export const CONTROL_CATEGORIES = ['Flags','Safety car','DRS','Decisions','Session','Other'] as const
export type ControlCategory = typeof CONTROL_CATEGORIES[number]
export type ControlMessage = RaceControl & { key:string; time:number|null; group:ControlCategory }
export function controlCategory(row: RaceControl): ControlCategory {
  const category = row.category?.toLowerCase() ?? ''
  if (category==='safetycar') return 'Safety car'
  if (category==='drs') return 'DRS'
  if (row.flag) return 'Flags'
  if (category==='sessionstatus') return 'Session'
  if (/PENALT(?:Y|IES)|INVESTIGAT|NO FURTHER ACTION|SUMMONS|NOTED|DELETED|TRACK LIMITS/i.test(row.message)) return 'Decisions'
  return 'Other'
}
export function controlMessages(raw: RaceControl[],session:number):ControlMessage[] {
  const unique = new Map<string,ControlMessage>()
  for (const row of raw) {
    if (row.session_key!==session || typeof row.message!=='string' || !row.message.trim()) continue
    const stamp = Date.parse(row.date), time = Number.isFinite(stamp)?stamp:null
    const date = time!==null?new Date(time).toISOString():row.date
    const key = JSON.stringify([date,row.message,row.flag,row.category,row.scope,row.sector,row.driver_number,row.lap_number])
    unique.set(key,{...row,date,key,time,driver_number:positiveInteger(row.driver_number),lap_number:positiveInteger(row.lap_number),sector:positiveInteger(row.sector),group:controlCategory(row)})
  }
  return [...unique.values()].sort((a,b)=>(a.time??Infinity)-(b.time??Infinity))
}
export function controlSignal(m:ControlMessage) {
  const flag = m.flag?.toUpperCase() ?? ''
  if(m.group==='Safety car') return {label:/VIRTUAL/i.test(m.message)?'VIRTUAL SC':'SAFETY CAR',color:'#e8cb5f',pattern:'caution'}
  if(flag==='CHEQUERED') return {label:'CHEQUERED',color:'#f5f5f3',pattern:'chequered'}
  if(flag==='DOUBLE YELLOW') return {label:'DOUBLE YELLOW',color:'#e8cb5f',pattern:'caution'}
  if(flag==='YELLOW') return {label:'YELLOW FLAG',color:'#e8cb5f',pattern:'solid'}
  if(flag==='RED') return {label:'RED FLAG',color:'#ef6868',pattern:'solid'}
  if(flag==='GREEN') return {label:'GREEN FLAG',color:'#70d8a2',pattern:'solid'}
  if(flag==='CLEAR') return {label:'CLEAR',color:'#d0dfd5',pattern:'solid'}
  if(flag==='BLUE') return {label:'BLUE FLAG',color:'#80b7fa',pattern:'solid'}
  if(flag==='BLACK AND WHITE') return {label:flag,color:'#eee',pattern:'split'}
  return {label:flag || (m.group==='Decisions'?'STEWARDS':m.group==='DRS'?'DRS':m.group==='Session'?'SESSION':'BULLETIN'),color:'#bbb',pattern:'solid'}
}
export function controlScope(m:ControlMessage) {
  if(m.scope?.toLowerCase()==='sector') return `SECTOR ${m.sector??'N/A'}`
  if(m.scope?.toLowerCase()==='driver') return `CAR ${m.driver_number??'N/A'}`
  if(m.scope?.toLowerCase()==='track') return 'TRACK'
  return m.driver_number ? `CAR ${m.driver_number}` : m.scope?.toUpperCase() || 'SCOPE NOT SPECIFIED'
}
export function featuredControl(messages:ControlMessage[]) {
  return messages.filter(m=>m.scope?.toLowerCase()==='track'||m.group==='Safety car'||m.group==='Session').at(-1) ?? messages.at(-1)
}
export function controlDeployments(messages:ControlMessage[]) {
  return messages.filter(m=>m.group==='Safety car' && /\bDEPLOYED\b/i.test(m.message) && !/\bNOT\b/i.test(m.message)).length
}
export function nearestControl(messages:ControlMessage[], ratio:number, group?:ControlCategory) {
  const known=messages.filter(m=>m.time!==null)
  if(!known.length)return null
  const target=known[0].time!+Math.max(0,Math.min(1,ratio))*(known.at(-1)!.time!-known[0].time!)
  const candidates=group?known.filter(m=>m.group===group):known
  if(!candidates.length)return null
  return candidates.reduce((best,m)=>Math.abs(m.time!-target)<Math.abs(best.time!-target)?m:best,candidates[0])
}
