begin;
alter table public.recommendation_preferences add column remember_searches boolean not null default false,add column remember_viewed boolean not null default true;
grant update(remember_searches,remember_viewed) on public.recommendation_preferences to authenticated;
create table public.recent_titles(user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,title_id uuid not null references public.titles(id) on delete restrict,viewed_at timestamptz not null default now(),primary key(user_id,title_id));
create table public.recent_searches(user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,query text not null check(char_length(query) between 1 and 120 and query!~'[[:cntrl:]]'),searched_at timestamptz not null default now(),primary key(user_id,query));
alter table public.recent_titles enable row level security;alter table public.recent_searches enable row level security;
revoke all on public.recent_titles,public.recent_searches from public,anon,authenticated,service_role;
grant select,delete on public.recent_titles,public.recent_searches to authenticated;
create policy recent_titles_owner on public.recent_titles for select to authenticated using(user_id=auth.uid() and app_private.member());
create policy recent_titles_delete on public.recent_titles for delete to authenticated using(user_id=auth.uid() and app_private.member());
create policy recent_searches_owner on public.recent_searches for select to authenticated using(user_id=auth.uid() and app_private.member());
create policy recent_searches_delete on public.recent_searches for delete to authenticated using(user_id=auth.uid() and app_private.member());
create index recent_titles_time on public.recent_titles(user_id,viewed_at desc);
create function public.remember_discovery(p_kind text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); canonical uuid; pref public.recommendation_preferences;
begin
 select * into pref from public.recommendation_preferences where user_id=who;
 if p_kind='title' then
  if not pref.remember_viewed then return;end if;
  canonical:=public.resolve_title(p_value::uuid);if canonical is null then raise exception 'Title unavailable.' using errcode='23514';end if;
  insert into public.recent_titles values(who,canonical,now()) on conflict(user_id,title_id) do update set viewed_at=excluded.viewed_at;
  delete from public.recent_titles where user_id=who and (viewed_at<now()-interval '90 days' or title_id in(select title_id from public.recent_titles where user_id=who order by viewed_at desc,title_id offset 40));
 elsif p_kind='search' then
  if not pref.remember_searches then return;end if;
  if p_value is null or char_length(btrim(p_value)) not between 1 and 120 or p_value~'[[:cntrl:]]' then raise exception 'Invalid search.' using errcode='23514';end if;
  insert into public.recent_searches values(who,btrim(p_value),now()) on conflict(user_id,query) do update set searched_at=excluded.searched_at;
  delete from public.recent_searches where user_id=who and (searched_at<now()-interval '30 days' or query in(select query from public.recent_searches where user_id=who order by searched_at desc,query offset 8));
 else raise exception 'Invalid discovery history.' using errcode='23514';end if;
end; $$;
create function app_private.discovery_privacy_event() returns trigger language plpgsql security definer set search_path='' as $$
begin if not new.remember_viewed then delete from public.recent_titles where user_id=new.user_id;end if;if not new.remember_searches then delete from public.recent_searches where user_id=new.user_id;end if;return new;end; $$;
create trigger discovery_privacy_event after update of remember_viewed,remember_searches on public.recommendation_preferences for each row execute function app_private.discovery_privacy_event();
alter table public.profiles add column cover_path text check(char_length(cover_path)<=300),add column featured_collection_id uuid references public.collections(id) on delete set null;
create function app_private.profile_customization_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cover_path is not null and new.cover_path!~('^'||new.id::text||'/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid profile cover.' using errcode='23514';end if;
 if new.featured_collection_id is not null and (tg_op='INSERT' or new.featured_collection_id is distinct from old.featured_collection_id) and not exists(select 1 from public.collections c where c.id=new.featured_collection_id and c.owner_id=new.id and c.visibility='published' and c.removed_at is null) then raise exception 'Feature an owned published collection.' using errcode='23514';end if;return new;
end; $$;
create trigger profile_customization_guard before insert or update on public.profiles for each row execute function app_private.profile_customization_guard();
create function app_private.unfeature_collection() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.visibility='private' or new.removed_at is not null then update public.profiles set featured_collection_id=null where featured_collection_id=new.id;end if;return new;end; $$;
create trigger unfeature_collection after update of visibility,removed_at on public.collections for each row execute function app_private.unfeature_collection();
grant update(cover_path,featured_collection_id) on public.profiles to authenticated;
create or replace function app_private.read_avatar(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.member() and exists(select 1 from public.profiles p where p.id::text=split_part(p_name,'/',1) and p_name~'^[a-f0-9-]{36}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' and (p.id=auth.uid() or ((p.avatar_path=p_name or p.cover_path=p_name) and app_private.can_interact(p.id))));
$$;
revoke all on function public.remember_discovery(text,text),app_private.discovery_privacy_event(),app_private.profile_customization_guard(),app_private.unfeature_collection() from public,anon,authenticated,service_role;
grant execute on function public.remember_discovery(text,text) to authenticated;
commit;
