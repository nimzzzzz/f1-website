/** Admin-only, explicit publish workflow. Never bundled into the site. */
import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { validateWeekend, scoreOfficialEntries } from '../lib/games/scoring'
import type { Weekend, Game } from '../lib/games/competition'
import type { Meeting, Session } from '../lib/openf1'

async function main() {
  const [command,file,...args]=process.argv.slice(2),apply=args.includes('--apply')
  if(command==='calendar') {
    const season=Number(file),rosterPath=args[0]
    if(!Number.isInteger(season) || !rosterPath) throw new Error('Usage: games:admin calendar YEAR roster.json')
    const fetchRows=async<T>(path:string):Promise<T[]>=>{const response=await fetch(`https://api.openf1.org/v1/${path}?year=${season}`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Calendar provider unavailable; no deadlines invented');return response.json()}
    const [meetings,sessions]=await Promise.all([fetchRows<Meeting>('meetings'),fetchRows<Session>('sessions')])
    const roster=JSON.parse(await readFile(rosterPath,'utf8'))
    const races=meetings.filter(m=>!m.is_cancelled && !/testing/i.test(m.meeting_name)).sort((a,b)=>Date.parse(a.date_start)-Date.parse(b.date_start))
    const draft=races.flatMap((m,index)=>{
      const qualifying=sessions.find(s=>s.meeting_key===m.meeting_key && !s.is_cancelled && s.session_name==='Qualifying'),race=sessions.find(s=>s.meeting_key===m.meeting_key && !s.is_cancelled && s.session_name==='Race')
      if(!qualifying || !race || Date.parse(qualifying.date_start)<=Date.now())return []
      const w={season,round:index+1,name:m.meeting_name,locks_at:qualifying.date_start,race_at:race.date_start,roster,budget:600};validateWeekend(w);return [w]
    })
    if(!draft.length)throw new Error('No confirmed upcoming Grand Prix qualifying sessions found')
    const output=`/tmp/lights-out-weekends-${season}.json`;await writeFile(output,JSON.stringify(draft,null,2));console.log(`Prepared ${draft.length} weekends at ${output}. Review the calendar, roster and prices before publishing.`);return
  }
  if(!['weekends','score'].includes(command) || !file)throw new Error('Usage: games:admin weekends FILE [--apply] | score FILE [--apply] | calendar YEAR ROSTER_FILE')
  const input=JSON.parse(await readFile(file,'utf8'))
  if(command==='weekends') {
    if(!Array.isArray(input)||!input.length)throw new Error('Expected an array of published weekends')
    input.forEach(validateWeekend)
    console.log(input.map(w=>({season:w.season,round:w.round,name:w.name,locks_at:w.locks_at,drivers:w.roster.length})))
    if(!apply){console.log('Validation passed. No changes made. Add --apply to publish.');return}
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)throw new Error('Set Supabase URL and the server-only service role key in this shell; never put the key in source or a public variable')
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  if(command==='weekends') {
    for(const w of input) {
      const {error}=await client.from('race_weekends').upsert({season:w.season,round:w.round,name:w.name,locks_at:w.locks_at,race_at:w.race_at,roster:w.roster,budget:w.budget},{onConflict:'season,round'})
      if(error)throw new Error(`Weekend ${w.round} was not published: ${error.message}`)
    }
    console.log('Weekends published. Existing rules with accepted entries remain frozen.');return
  }
  if(typeof input.weekendId!=='string' || !Number.isInteger(input.version))throw new Error('Result file requires weekendId, integer version and result')
  const [weekend,entries]=await Promise.all([client.from('race_weekends').select('*').eq('id',input.weekendId).single(),client.from('race_entries').select('player_id,game,payload').eq('weekend_id',input.weekendId)])
  if(weekend.error||entries.error)throw new Error('Could not load the weekend and its entries')
  const scores=scoreOfficialEntries(weekend.data as Weekend,entries.data as {player_id:string;game:Game;payload:unknown}[],input.result)
  console.log(`Validated ${scores.length} entries for ${weekend.data.name}, result version ${input.version}.`)
  if(!apply){console.log('No scores published. Add --apply after verifying the final classification and safety-car report.');return}
  const {error}=await client.rpc('publish_weekend_scores',{p_weekend:input.weekendId,p_version:input.version,p_result:input.result,p_source:input.result.source,p_scores:scores})
  if(error)throw new Error(`Scores were not published: ${error.message}`)
  console.log('Final scores published atomically. Repeating this version cannot award duplicate points.')
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Competition operation failed');process.exitCode=1})
