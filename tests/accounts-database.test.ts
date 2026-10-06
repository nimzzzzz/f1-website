import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002', outsider = '10000000-0000-4000-8000-000000000003'
const future = '20000000-0000-4000-8000-000000000001', past = '20000000-0000-4000-8000-000000000002'
let db: PGlite
const lineup = { lineup: { leader: 'a', charger: 'b', rival: 'c' } }
const ticket = { picks: { pole: 'a', first: 'a', second: 'b', third: 'c', mover: 'c', safety: 'yes' }, boost: 'first' }
async function asUser(id: string) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${id}'`) }
async function admin() { await db.exec('reset role') }
beforeAll(async () => {
 db = new PGlite()
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to public;`)
 await db.exec(readFileSync('supabase/migrations/202610070001_games.sql','utf8'))
 await db.query('insert into auth.users values($1),($2),($3)',[a,b,outsider])
 const roster = JSON.stringify([{id:'a',price:200},{id:'b',price:200},{id:'c',price:200},{id:'d',price:300}])
 await db.query(`insert into race_weekends(id,season,round,name,locks_at,race_at,roster) values ($1,2026,1,'Open race',now()+interval '1 day',now()+interval '2 days',$3),($2,2026,2,'Finished race',now()-interval '2 days',now()-interval '1 day',$3)`,[future,past,roster])
},30_000)
afterAll(async()=>{await db.close()})
describe.sequential('database trust boundaries',()=>{
 it('creates private profiles and hides other players saves',async()=>{
  await asUser(a)
  expect((await db.query('select * from player_profiles')).rows).toHaveLength(1)
  expect((await db.query('select save_practice($1,$2,$3) revision',['fantasy','{"version":1}',0])).rows).toEqual([{revision:1}])
  await expect(db.query('select save_practice($1,$2,$3)',['fantasy','{}',0])).rejects.toThrow('SAVE_CONFLICT')
  await asUser(b); expect((await db.query('select * from practice_saves')).rows).toHaveLength(0)
  await expect(db.query('insert into race_scores values($1,$2,$3,999,0,0,$4,1)',[b,future,'fantasy','{}'])).rejects.toThrow('permission denied')
 })
 it('validates roster, budget, duplicates and deadlines inside the database',async()=>{
  await asUser(a)
  await db.query('select submit_race_entry($1,$2,$3)',[future,'fantasy',JSON.stringify(lineup)])
  await db.query('select submit_race_entry($1,$2,$3)',[future,'predictions',JSON.stringify(ticket)])
  for(const payload of [{lineup:{leader:'a',charger:'a',rival:'b'}},{lineup:{leader:'a',charger:'b',rival:'d'}},{lineup:{leader:'a',charger:'b',rival:'unknown'}}]) await expect(db.query('select submit_race_entry($1,$2,$3)',[future,'fantasy',JSON.stringify(payload)])).rejects.toThrow()
  await expect(db.query('select submit_race_entry($1,$2,$3)',[past,'fantasy',JSON.stringify(lineup)])).rejects.toThrow('ENTRY_LOCKED')
  await expect(db.query('select submit_race_entry($1,$2,$3)',[future,'predictions',JSON.stringify({...ticket,picks:{...ticket.picks,second:'a'}})])).rejects.toThrow('different podium')
  await expect(db.query('select submit_race_entry($1,$2,$3)',[future,'predictions',JSON.stringify({...ticket,picks:{...ticket.picks,mover:'unknown'}})])).rejects.toThrow('eligible')
  await asUser(b); expect((await db.query('select * from race_entries')).rows).toHaveLength(0)
  await admin(); await expect(db.query("update race_weekends set locks_at=now()+interval '3 days' where id=$1",[future])).rejects.toThrow('frozen')
 })
 it('protects private leagues and revokes rotated invites',async()=>{
  await asUser(a)
  const result = await db.query<{id:string}>('select create_private_league($1,$2,$3) id',['The rivals','fantasy',2026]); const id=result.rows[0].id
  const invite = (await db.query<{invite_code:string}>('select invite_code from private_leagues where id=$1',[id])).rows[0].invite_code
  await asUser(outsider); expect((await db.query('select * from private_leagues')).rows).toHaveLength(0)
  await expect(db.query('select * from game_standings($1,$2,$3)',['fantasy',2026,id])).rejects.toThrow('membership')
  await asUser(b); await db.query('select join_private_league($1)',[invite]); expect((await db.query('select * from league_members')).rows).toHaveLength(2)
  await expect(db.query('select rotate_league_invite($1)',[id])).rejects.toThrow('owner')
  await asUser(a); await db.query('select rotate_league_invite($1)',[id]); await asUser(outsider)
  await expect(db.query('select join_private_league($1)',[invite])).rejects.toThrow('not found')
 })
 it('publishes all scores atomically, separates games and prevents duplicate awards',async()=>{
  await admin(); await db.query('insert into race_entries(player_id,weekend_id,game,payload) values($1,$2,$3,$4)',[a,past,'fantasy',JSON.stringify(lineup)])
  const scores=JSON.stringify([{player_id:a,game:'fantasy',points:55,bonus:8,leader:25,breakdown:{total:55}}])
  await asUser(a); await expect(db.query('select publish_weekend_scores($1,1,$2,$3,$4)',[past,'{}','https://example.org',scores])).rejects.toThrow('permission denied')
  await admin(); await db.exec('set role service_role')
  await expect(db.query('select publish_weekend_scores($1,1,$2,$3,$4)',[past,'{}','https://example.org','[]'])).rejects.toThrow('Every entry')
  await db.query('select publish_weekend_scores($1,1,$2,$3,$4)',[past,'{}','https://example.org',scores])
  await expect(db.query('select publish_weekend_scores($1,1,$2,$3,$4)',[past,'{}','https://example.org',scores])).rejects.toThrow('VERSION_CONFLICT')
  await expect(db.query('select publish_weekend_scores($1,2,$2,$3,$4)',[past,'{}','https://example.org',JSON.stringify([{player_id:b,game:'fantasy',points:999,bonus:0,leader:0,breakdown:{}}])])).rejects.toThrow()
  await asUser(a)
  expect((await db.query<{points:number}>('select * from game_standings($1,$2)',['fantasy',2026])).rows[0].points).toBe(55)
  expect((await db.query<{points:number}>('select * from game_standings($1,$2)',['predictions',2026])).rows[0].points).toBe(0)
 })
})
