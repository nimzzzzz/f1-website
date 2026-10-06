-- Accounts, private cloud saves, locked race entries and separate competitions.
-- Apply once to a new Supabase project. No client has direct write permission.
begin;
create table public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New driver' check (char_length(btrim(display_name)) between 2 and 24),
  created_at timestamptz not null default now()
);
create table public.practice_saves (
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  game text not null check (game in ('fantasy','predictions')),
  data jsonb not null check (octet_length(data::text) <= 60000),
  revision integer not null default 1, updated_at timestamptz not null default now(),
  primary key(player_id,game)
);
create table public.race_weekends (
  id uuid primary key default gen_random_uuid(), season integer not null check (season between 2026 and 2100),
  round integer not null check (round between 1 and 30), name text not null,
  locks_at timestamptz not null, race_at timestamptz not null check (race_at > locks_at),
  -- Published eligibility and prices are immutable after any entry is accepted.
  roster jsonb not null check (jsonb_typeof(roster) = 'array'), budget integer not null default 600 check (budget > 0),
  status text not null default 'open' check (status in ('open','final','cancelled')),
  result_version integer not null default 0, official_result jsonb, source_url text,
  unique(season,round)
);
create table public.race_entries (
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  weekend_id uuid not null references public.race_weekends(id),
  game text not null check (game in ('fantasy','predictions')), payload jsonb not null,
  updated_at timestamptz not null default now(), primary key(player_id,weekend_id,game)
);
create table public.race_scores (
  player_id uuid not null, weekend_id uuid not null, game text not null,
  points integer not null, bonus integer not null, leader integer not null,
  breakdown jsonb not null, result_version integer not null,
  primary key(player_id,weekend_id,game),
  foreign key(player_id,weekend_id,game) references public.race_entries(player_id,weekend_id,game) on delete cascade
);
create table public.private_leagues (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.player_profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 32),
  game text not null check(game in ('fantasy','predictions')), season integer not null check(season between 2026 and 2100),
  invite_code uuid not null default gen_random_uuid() unique, created_at timestamptz not null default now()
);
create table public.league_members (
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(), primary key(league_id,player_id)
);
create index race_entries_weekend on public.race_entries(weekend_id,game);
create index race_scores_weekend on public.race_scores(weekend_id,game);
create index league_members_player on public.league_members(player_id);

create function public.create_player_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.player_profiles(id) values(new.id); return new; end $$;
create trigger create_player after insert on auth.users for each row execute function public.create_player_profile();
insert into public.player_profiles(id) select id from auth.users on conflict do nothing;

alter table public.player_profiles enable row level security;
alter table public.practice_saves enable row level security;
alter table public.race_weekends enable row level security;
alter table public.race_entries enable row level security;
alter table public.race_scores enable row level security;
alter table public.private_leagues enable row level security;
alter table public.league_members enable row level security;

create function public.is_league_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.league_members where league_id=target and player_id=auth.uid());
$$;
create policy own_profile on public.player_profiles for select to authenticated using(id=auth.uid());
create policy own_save on public.practice_saves for select to authenticated using(player_id=auth.uid());
create policy public_weekends on public.race_weekends for select to anon,authenticated using(true);
create policy visible_entries on public.race_entries for select to authenticated using(player_id=auth.uid() or exists(select 1 from public.race_weekends w where w.id=weekend_id and w.locks_at<=now()));
create policy visible_scores on public.race_scores for select to authenticated using(true);
create policy member_leagues on public.private_leagues for select to authenticated using(public.is_league_member(id));
create policy member_roster on public.league_members for select to authenticated using(public.is_league_member(league_id));

create function public.update_player_name(new_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update public.player_profiles set display_name=btrim(new_name) where id=auth.uid();
end $$;

create function public.save_practice(p_game text,p_data jsonb,p_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare actual integer;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 -- Serialize even two first saves, before a row exists.
 perform 1 from public.player_profiles where id=auth.uid() for update;
 select revision into actual from public.practice_saves where player_id=auth.uid() and game=p_game;
 if coalesce(actual,0) is distinct from p_revision then raise exception 'SAVE_CONFLICT'; end if;
 insert into public.practice_saves(player_id,game,data) values(auth.uid(),p_game,p_data)
 on conflict(player_id,game) do update set data=excluded.data,revision=public.practice_saves.revision+1,updated_at=clock_timestamp()
 returning revision into actual;
 return actual;
end $$;

create function public.submit_race_entry(p_weekend uuid,p_game text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare w public.race_weekends; ids text[]; cost integer; valid_count integer; picks jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into w from public.race_weekends where id=p_weekend for update;
 if not found or w.status<>'open' or clock_timestamp()>=w.locks_at then raise exception 'ENTRY_LOCKED'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then raise exception 'Invalid entry'; end if;
 if p_game='fantasy' then
   if jsonb_typeof(p_payload->'lineup') is distinct from 'object' then raise exception 'Choose three driver roles'; end if;
   ids:=array[p_payload#>>'{lineup,leader}',p_payload#>>'{lineup,charger}',p_payload#>>'{lineup,rival}'];
   if (select count(distinct id) from unnest(ids) id)<>3 then raise exception 'Choose three different drivers'; end if;
   select count(*),sum((d->>'price')::integer) into valid_count,cost from jsonb_array_elements(w.roster) d where d->>'id'=any(ids);
   if valid_count<>3 or cost>w.budget then raise exception 'Squad exceeds budget or contains an ineligible driver'; end if;
   p_payload:=jsonb_build_object('lineup',p_payload->'lineup');
 elsif p_game='predictions' then
   picks:=p_payload->'picks';
   if jsonb_typeof(picks) is distinct from 'object' then raise exception 'Complete all six calls'; end if;
   ids:=array[picks->>'pole',picks->>'first',picks->>'second',picks->>'third',picks->>'mover'];
   if exists(select 1 from unnest(ids) id where id is null or not exists(select 1 from jsonb_array_elements(w.roster) d where d->>'id'=id)) then raise exception 'Choose eligible drivers'; end if;
   if (select count(distinct id) from unnest(array[picks->>'first',picks->>'second',picks->>'third']) id)<>3 then raise exception 'Choose three different podium drivers'; end if;
   if coalesce(picks->>'safety','') not in ('yes','no') or coalesce(p_payload->>'boost','') not in ('pole','first','second','third','mover','safety') then raise exception 'Choose safety car and confidence calls'; end if;
   p_payload:=jsonb_build_object('picks',picks,'boost',p_payload->>'boost');
 else raise exception 'Unknown game'; end if;
 insert into public.race_entries(player_id,weekend_id,game,payload) values(auth.uid(),p_weekend,p_game,p_payload)
 on conflict(player_id,weekend_id,game) do update set payload=excluded.payload,updated_at=clock_timestamp();
end $$;

create function public.create_private_league(p_name text,p_game text,p_season integer) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform 1 from public.player_profiles where id=auth.uid() for update;
 if (select count(*) from public.private_leagues where owner_id=auth.uid())>=10 then raise exception 'You can own up to ten leagues'; end if;
 insert into public.private_leagues(owner_id,name,game,season) values(auth.uid(),btrim(p_name),p_game,p_season) returning id into result;
 insert into public.league_members values(result,auth.uid(),now()); return result;
end $$;
create function public.join_private_league(p_code uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into target from public.private_leagues where invite_code=p_code for update;
 if target is null then raise exception 'Invite not found'; end if;
 if exists(select 1 from public.league_members where league_id=target and player_id=auth.uid()) then return target; end if;
 if (select count(*) from public.league_members where league_id=target)>=16 then raise exception 'This league is full (16 players)'; end if;
 insert into public.league_members values(target,auth.uid(),clock_timestamp()); return target;
end $$;
create function public.rotate_league_invite(p_league uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare code uuid;
begin
 update public.private_leagues set invite_code=gen_random_uuid() where id=p_league and owner_id=auth.uid() returning invite_code into code;
 if code is null then raise exception 'League owner required'; end if;
 return code;
end $$;

-- Public display names only, never emails. Private league membership is checked before aggregation.
create function public.game_standings(p_game text,p_season integer,p_league uuid default null)
returns table(player_id uuid,display_name text,points bigint,played bigint,rank bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_league is not null and not exists(select 1 from public.private_leagues where id=p_league and game=p_game and season=p_season and public.is_league_member(id)) then raise exception 'League membership required'; end if;
 return query with totals as (
   select p.id,p.display_name,coalesce(sum(s.points),0)::bigint pts,count(s.weekend_id) played
   from public.player_profiles p
   left join (public.race_scores s join public.race_weekends w on w.id=s.weekend_id and w.season=p_season and w.status='final') on s.player_id=p.id and s.game=p_game
   where (p_league is not null and exists(select 1 from public.league_members m where m.league_id=p_league and m.player_id=p.id))
     or (p_league is null and exists(select 1 from public.race_entries e join public.race_weekends w on w.id=e.weekend_id where e.player_id=p.id and e.game=p_game and w.season=p_season))
   group by p.id
 ) select t.id,t.display_name,t.pts,t.played,dense_rank() over(order by t.pts desc) from totals t order by t.pts desc,t.display_name,t.id limit 1000;
end $$;

-- Trusted scorer only. One atomic, versioned replacement; resubmitting a version cannot add points twice.
create function public.publish_weekend_scores(p_weekend uuid,p_version integer,p_result jsonb,p_source text,p_scores jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare w public.race_weekends; expected integer;
begin
 select * into w from public.race_weekends where id=p_weekend for update;
 if not found or w.status='cancelled' or clock_timestamp()<w.race_at then raise exception 'Weekend cannot be scored yet'; end if;
 if p_version<=w.result_version then raise exception 'RESULT_VERSION_CONFLICT'; end if;
 select count(*) into expected from public.race_entries where weekend_id=p_weekend;
 if jsonb_array_length(p_scores)<>expected then raise exception 'Every entry must be scored'; end if;
 delete from public.race_scores where weekend_id=p_weekend;
 insert into public.race_scores(player_id,weekend_id,game,points,bonus,leader,breakdown,result_version)
 select (s->>'player_id')::uuid,p_weekend,s->>'game',(s->>'points')::integer,(s->>'bonus')::integer,(s->>'leader')::integer,s->'breakdown',p_version from jsonb_array_elements(p_scores) s;
 update public.race_weekends set status='final',result_version=p_version,official_result=p_result,source_url=p_source where id=p_weekend;
end $$;

-- Even the administrator must publish roster/deadline changes before the first entry.
create function public.protect_weekend_rules() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.roster is distinct from old.roster or new.budget<>old.budget or new.locks_at<>old.locks_at or new.round<>old.round or new.season<>old.season)
    and exists(select 1 from public.race_entries where weekend_id=old.id) then raise exception 'Published entry rules are frozen'; end if;
 return new;
end $$;
create trigger freeze_weekend_rules before update on public.race_weekends for each row execute function public.protect_weekend_rules();

revoke all on public.player_profiles,public.practice_saves,public.race_weekends,public.race_entries,public.race_scores,public.private_leagues,public.league_members from anon,authenticated;
grant select on public.player_profiles,public.practice_saves,public.race_weekends,public.race_entries,public.race_scores,public.private_leagues,public.league_members to authenticated;
grant select on public.race_weekends to anon;
grant all on public.player_profiles,public.practice_saves,public.race_weekends,public.race_entries,public.race_scores,public.private_leagues,public.league_members to service_role;
revoke all on function public.create_player_profile(),public.is_league_member(uuid),public.update_player_name(text),public.save_practice(text,jsonb,integer),public.submit_race_entry(uuid,text,jsonb),public.create_private_league(text,text,integer),public.join_private_league(uuid),public.rotate_league_invite(uuid),public.game_standings(text,integer,uuid),public.publish_weekend_scores(uuid,integer,jsonb,text,jsonb),public.protect_weekend_rules() from public,anon,authenticated;
grant execute on function public.is_league_member(uuid),public.update_player_name(text),public.save_practice(text,jsonb,integer),public.submit_race_entry(uuid,text,jsonb),public.create_private_league(text,text,integer),public.join_private_league(uuid),public.rotate_league_invite(uuid),public.game_standings(text,integer,uuid) to authenticated;
grant execute on function public.publish_weekend_scores(uuid,integer,jsonb,text,jsonb) to service_role;
commit;
