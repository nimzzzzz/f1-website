import { authenticatedAccount } from '@/lib/supabase/server'
import { json, readBody } from '@/lib/games/http'
import { liveCup, type Weekend, type LiveScore, type LeagueMember } from '@/lib/games/competition'
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s)
export async function GET(request: Request) {
  const url=new URL(request.url), game=url.searchParams.get('game'), league=url.searchParams.get('league')
  if (!['fantasy','predictions'].includes(game ?? '') || (league && !uuid(league))) return json({error:'Unknown competition.'},400)
  const account=await authenticatedAccount()
  if (!account) return json({error:'Sign in to play online.'},401)
  const client=account.client, season=new Date().getUTCFullYear()
  const [weekends, leagues, entries, table]=await Promise.all([
    client.from('race_weekends').select('*').eq('season',season).order('round'),
    client.from('private_leagues').select('id,name,game,owner_id,invite_code,season').eq('game',game).eq('season',season),
    client.from('race_entries').select('weekend_id,game,payload,updated_at').eq('player_id',account.user.id).eq('game',game),
    client.rpc('game_standings',{p_game:game,p_season:season,p_league:league}),
  ])
  if (weekends.error || leagues.error || entries.error || table.error) return json({error:'This competition could not be loaded. Check your membership and try again.'},503)
  const ids=weekends.data.map(w=>w.id)
  const own=ids.length ? await client.from('race_scores').select('*').eq('player_id',account.user.id).eq('game',game).in('weekend_id',ids) : {data:[],error:null}
  if(own.error) return json({error:'Your results could not be loaded.'},503)
  let cups: ReturnType<typeof liveCup>[]=[]
  if(league && game==='fantasy') {
    const members=await client.from('league_members').select('player_id,joined_at').eq('league_id',league)
    if(members.error) return json({error:'Your league could not be loaded.'},503)
    const players=members.data.map(m=>m.player_id)
    const scores=players.length && ids.length ? await client.from('race_scores').select('*').eq('game',game).in('player_id',players).in('weekend_id',ids) : {data:[],error:null}
    if(scores.error) return json({error:'Cup scores could not be loaded.'},503)
    cups=Array.from({length:Math.ceil(Math.max(0,...weekends.data.map(w=>w.round))/4)},(_,i)=>liveCup(weekends.data as Weekend[],members.data as LeagueMember[],scores.data as LiveScore[],i+1,Date.now())).filter(Boolean)
  }
  return json({playerId:account.user.id,season,serverTime:new Date().toISOString(),weekends:weekends.data,entries:entries.data.filter(e=>ids.includes(e.weekend_id)),scores:own.data,leagues:leagues.data,standings:table.data,cups})
}
export async function POST(request: Request) {
  const body=await readBody(request)
  if(!body) return json({error:'Invalid request.'},400)
  const account=await authenticatedAccount()
  if(!account) return json({error:'Sign in to play online.'},401)
  let result
  if(body.action==='entry' && uuid(body.weekend) && ['fantasy','predictions'].includes(String(body.game)) && body.payload && typeof body.payload==='object') result=await account.client.rpc('submit_race_entry',{p_weekend:body.weekend,p_game:body.game,p_payload:body.payload})
  else if(body.action==='create' && typeof body.name==='string' && body.name.trim().length>=2 && body.name.trim().length<=32 && ['fantasy','predictions'].includes(String(body.game))) result=await account.client.rpc('create_private_league',{p_name:body.name.trim(),p_game:body.game,p_season:new Date().getUTCFullYear()})
  else if(body.action==='join' && uuid(body.code)) result=await account.client.rpc('join_private_league',{p_code:body.code})
  else if(body.action==='rotate' && uuid(body.league)) result=await account.client.rpc('rotate_league_invite',{p_league:body.league})
  else return json({error:'Check your entry and try again.'},400)
  if(result.error) {
    const known=['ENTRY_LOCKED','Choose three driver roles','Choose three different drivers','Squad exceeds budget or contains an ineligible driver','Choose eligible drivers','Choose three different podium drivers','Choose safety car and confidence calls','Invite not found','This league is full (16 players)','League owner required','You can own up to ten leagues']
    const reason=known.find(message=>result.error.message.includes(message))
    return json({error:reason==='ENTRY_LOCKED' ? 'This weekend is locked. Your saved entry has not changed.' : reason ?? 'That action could not be completed. Please retry.'},reason==='ENTRY_LOCKED'?409:400)
  }
  return json({ok:true,id:result.data})
}
