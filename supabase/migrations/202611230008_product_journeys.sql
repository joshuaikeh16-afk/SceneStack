begin;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to anon,authenticated;
alter table public.titles add column popularity numeric check(popularity is null or (popularity>=0 and popularity<1000000000));
create index titles_name_fuzzy on public.titles using gin(display_title extensions.gin_trgm_ops);
create index aliases_name_fuzzy on public.title_names using gin(name extensions.gin_trgm_ops);
alter table public.collections add column client_request_id uuid;
create unique index collection_creation_request on public.collections(owner_id,client_request_id) where client_request_id is not null;
alter table public.collection_imports add column client_request_id uuid;
create unique index collection_import_request on public.collection_imports(user_id,client_request_id) where client_request_id is not null;
alter table public.onboarding add column step smallint not null default 1 check(step between 1 and 4);
alter table public.onboarding add column draft_username text check(char_length(draft_username)<=30);
alter table public.onboarding add column draft_display_name text check(char_length(draft_display_name)<=80);
create table public.title_feedback (
  id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title_id uuid not null references public.titles(id) on delete cascade,
  feedback text not null check(feedback in ('not_interested','already_seen')),created_at timestamptz not null default now(),unique(user_id,title_id)
);
alter table public.title_feedback enable row level security;
revoke all on public.title_feedback from public,anon,authenticated,service_role;
grant select,delete on public.title_feedback to authenticated;
create policy feedback_read on public.title_feedback for select to authenticated using(user_id=auth.uid() and app_private.member());
create policy feedback_delete on public.title_feedback for delete to authenticated using(user_id=auth.uid() and app_private.member());

create function public.browse_catalog(p_query text default '',p_category public.entertainment_kind default null,p_year integer default null,p_genre uuid default null,p_language text default null,p_country text default null,p_min_rating numeric default null,p_sort text default 'popular',p_status public.catalog_status default null,p_limit integer default 24,p_offset integer default 0) returns setof public.titles language plpgsql stable security invoker set search_path='' as $$
begin
  if p_query is null or char_length(p_query)>120 or p_query ~ '[[:cntrl:]]' or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 or p_sort is null or p_sort not in ('title','year','added','popular') or (p_year is not null and p_year not between 1888 and 2200) or (p_min_rating is not null and (p_min_rating<1 or p_min_rating>10)) then raise exception 'Invalid catalog query.' using errcode='23514'; end if;
  return query select t.* from public.titles t where t.status<>'merged'
    and (p_category is null or t.kind=p_category) and (p_year is null or t.release_year=p_year) and (p_status is null or t.status=p_status)
    and (p_query='' or t.search_document@@websearch_to_tsquery('simple',p_query) or t.display_title operator(extensions.%) p_query
      or exists(select 1 from public.title_names n where n.title_id=t.id and (n.search_document@@websearch_to_tsquery('simple',p_query) or n.name operator(extensions.%) p_query))
      or exists(select 1 from public.title_genres tg join public.genres g on g.id=tg.genre_id where tg.title_id=t.id and strpos(lower(g.name),lower(p_query))>0))
    and (p_genre is null or exists(select 1 from public.title_genres g where g.title_id=t.id and g.genre_id=p_genre))
    and (p_language is null or exists(select 1 from public.title_languages l where l.title_id=t.id and l.language_code=p_language))
    and (p_country is null or exists(select 1 from public.title_countries c where c.title_id=t.id and c.country_code=p_country))
    and (p_min_rating is null or (public.community_rating(t.id)->>'score')::numeric>=p_min_rating)
    order by case when p_query<>'' then extensions.similarity(t.display_title,p_query) end desc,
      case when p_sort='title' then t.display_title end asc,case when p_sort='year' then t.release_year end desc nulls last,
      case when p_sort='added' then t.created_at end desc,case when p_sort='popular' then t.popularity end desc nulls last,t.id asc limit p_limit offset p_offset;
end; $$;
create function public.set_favorite(p_title uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if p_enabled is null then raise exception 'Invalid favorite state.' using errcode='23514'; end if;
  perform app_private.rate_limit('favorites',300,interval '1 hour');
  if p_enabled then insert into public.favorites(user_id,title_id) values(who,p_title) on conflict(user_id,title_id) do nothing;
  else delete from public.favorites where user_id=who and title_id=p_title; end if;
end; $$;
create function public.create_collection_with_titles(p_request uuid,p_title text,p_description text default '',p_visibility public.collection_visibility default 'private',p_spoiler boolean default false,p_titles uuid[] default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  if p_request is null or p_titles is null or cardinality(p_titles)>100 then raise exception 'Invalid collection request.' using errcode='23514'; end if;
  perform 1 from public.profiles where id=who for update;
  select id into result from public.collections where owner_id=who and client_request_id=p_request;
  if found then return result; end if;
  perform app_private.rate_limit('create_collection',60,interval '1 hour');
  insert into public.collections(owner_id,title,description,visibility,spoiler_warning,client_request_id) values(who,p_title,p_description,p_visibility,p_spoiler,p_request) returning id into result;
  insert into public.collection_items(collection_id,title_id,position) select result,x,row_number() over(order by first_position)-1 from (select x,min(n) first_position from unnest(p_titles) with ordinality a(x,n) group by x) q;
  return result;
end; $$;
create function public.add_titles_to_collections(p_collections uuid[],p_titles uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); c uuid; start_position bigint;
begin
  if p_collections is null or p_titles is null or cardinality(p_collections) not between 1 and 50 or cardinality(p_titles) not between 1 and 100 then raise exception 'Choose collections and titles.' using errcode='23514'; end if;
  perform id from public.collections where id=any(p_collections) order by id for update;
  if exists(select 1 from unnest(p_collections) x where not app_private.owns_collection(x)) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('add_to_collections',300,interval '1 hour');
  for c in select distinct unnest(p_collections) loop
    select coalesce(max(position),-1)+1 into start_position from public.collection_items where collection_id=c;
    insert into public.collection_items(collection_id,title_id,position)
      select c,q.x,start_position+q.n-1 from unnest(p_titles) with ordinality q(x,n) on conflict(collection_id,title_id) do nothing;
    update public.collections set updated_at=now() where id=c;
  end loop;
end; $$;
create function public.set_collection_interaction(p_collection uuid,p_kind text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if p_enabled is null or p_kind is null or p_kind not in ('favorite','save') then raise exception 'Invalid interaction.' using errcode='23514'; end if;
  if p_enabled then
    if p_kind='favorite' then insert into public.collection_favorites(user_id,collection_id) values(who,p_collection) on conflict(user_id,collection_id) do nothing;
    else insert into public.collection_saves(user_id,collection_id) values(who,p_collection) on conflict(user_id,collection_id) do nothing; end if;
  else
    if p_kind='favorite' then delete from public.collection_favorites where user_id=who and collection_id=p_collection;
    else delete from public.collection_saves where user_id=who and collection_id=p_collection; end if;
  end if;
end; $$;
create function public.import_collection_once(p_source uuid,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  if p_request is null then raise exception 'Invalid import request.' using errcode='23514'; end if;
  perform 1 from public.profiles where id=who for update;
  select imported_collection_id into result from public.collection_imports where user_id=who and client_request_id=p_request;
  if found then return result; end if;
  result:=public.import_collection(p_source);
  update public.collection_imports set client_request_id=p_request where user_id=who and imported_collection_id=result;
  return result;
end; $$;
create function public.mark_all_notifications_read() returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin update public.notifications set read_at=now() where recipient_id=who and read_at is null; end; $$;
create function public.set_title_feedback(p_title uuid,p_feedback text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if p_feedback is null or p_feedback not in ('not_interested','already_seen') then raise exception 'Invalid feedback.' using errcode='23514'; end if;
  insert into public.title_feedback(user_id,title_id,feedback) values(who,p_title,p_feedback) on conflict(user_id,title_id) do update set feedback=excluded.feedback;
end; $$;
create function public.recommend_title_ids(p_limit integer default 24) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); payload jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size.' using errcode='23514'; end if;
  if not exists(select 1 from public.recommendation_preferences where user_id=who and enabled) then return '[]'; end if;
  with candidates as (
    select t.id,t.display_title,
      case when exists(select 1 from public.preferred_categories c where c.user_id=who and c.category=t.kind) then 3 else 0 end+
      (select count(*)::int*4 from public.title_genres tg join public.favorite_genres fg on fg.genre_id=tg.genre_id and fg.user_id=who where tg.title_id=t.id)+
      (select count(*)::int from public.title_genres tg where tg.title_id=t.id and exists(select 1 from public.title_genres signal join public.favorites f on f.title_id=signal.title_id and f.user_id=who where signal.genre_id=tg.genre_id))+
      (select count(*)::int from public.title_genres tg where tg.title_id=t.id and exists(select 1 from public.title_genres signal join public.ratings r on r.title_id=signal.title_id and r.user_id=who and r.score>=7 where signal.genre_id=tg.genre_id)) relevancy,
      (select g.name from public.title_genres tg join public.favorite_genres fg on fg.genre_id=tg.genre_id and fg.user_id=who join public.genres g on g.id=tg.genre_id where tg.title_id=t.id order by g.name limit 1) favorite_genre,
      exists(select 1 from public.preferred_categories c where c.user_id=who and c.category=t.kind) preferred
    from public.titles t where t.status<>'merged' and not exists(select 1 from public.title_feedback f where f.user_id=who and f.title_id=t.id)
      and not exists(select 1 from public.tracking tr where tr.user_id=who and tr.title_id=t.id and tr.status in ('completed','dropped'))
      and (coalesce(t.age_rating,'') not in ('R','NC-17','18','TV-MA') or exists(select 1 from public.recommendation_preferences r where r.user_id=who and r.include_mature))
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',case when favorite_genre is not null then 'Because you enjoy '||lower(favorite_genre)||'.' when preferred then 'From a category you enjoy.' when relevancy>0 then 'Related to your own favorites and ratings.' else 'A little room for something different.' end)),'[]') into payload
    from (select * from candidates order by relevancy desc,display_title,id limit p_limit) q;
  return payload;
end; $$;
create function public.save_onboarding_progress(p_step integer,p_username text default null,p_display_name text default null) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if p_step is null or p_step not between 1 and 4 or char_length(p_username)>30 or char_length(p_display_name)>80 then raise exception 'Invalid onboarding progress.' using errcode='23514'; end if;
  update public.onboarding set step=p_step,draft_username=p_username,draft_display_name=p_display_name where user_id=who and completed_at is null;
end; $$;
create function public.username_available(p_username text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare candidate text:=lower(btrim(p_username));
begin
  perform app_private.require_member();
  return candidate is not null and candidate ~ '^[a-z][a-z0-9_]{2,29}$' and candidate not in ('admin','administrator','moderator','scenestack','support','official') and not exists(select 1 from public.profiles where lower(username)=candidate and id<>auth.uid());
end; $$;
create function public.admin_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not (app_private.has_role('moderator') or app_private.has_role('catalog_editor')) then raise exception 'Administration unavailable.' using errcode='42501'; end if;
  return jsonb_build_object('titles',(select count(*) from public.titles where status<>'merged'),'publicCollections',(select count(*) from public.collections c join public.profiles p on p.id=c.owner_id where c.visibility='published' and c.removed_at is null and p.status='active'),'members',(select count(*) from public.profiles where status='active'));
end; $$;
create function public.admin_profiles(p_query text default '',p_limit integer default 24,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_role('moderator') then raise exception 'Administration unavailable.' using errcode='42501'; end if;
  if p_query is null or char_length(p_query)>120 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid page.' using errcode='23514'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (select id,username,display_name,status,created_at from public.profiles where strpos(lower(display_name),lower(p_query))>0 or strpos(coalesce(username,''),lower(p_query))>0 order by created_at desc,id limit p_limit offset p_offset) q);
end; $$;
create function public.admin_account_action(p_user uuid,p_action public.moderation_kind,p_reason text,p_until timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.has_role('moderator') or p_action is null or p_action not in ('warning','suspension','ban') or (p_action='ban' and not app_private.has_role('super_admin')) then raise exception 'Moderation unavailable.' using errcode='42501'; end if;
  if exists(select 1 from app_private.platform_owner where user_id=p_user) or (not app_private.has_role('super_admin') and exists(select 1 from public.admin_roles where user_id=p_user)) then raise exception 'Moderation target unavailable.' using errcode='42501'; end if;
  if p_action='suspension' and (p_until is null or p_until<=now() or p_until>now()+interval '365 days') then raise exception 'Invalid suspension period.' using errcode='23514'; end if;
  if p_action in ('suspension','ban') then update public.profiles set status=case when p_action='ban' then 'banned'::public.account_status else 'suspended'::public.account_status end where id=p_user and status<>'purging'; end if;
  insert into public.moderation_actions(actor_id,target_user_id,action,reason,expires_at) values(auth.uid(),p_user,p_action,p_reason,p_until);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'account_moderation','profile',p_user,p_action::text);
end; $$;

create function public.library_titles(p_section text default 'tracking',p_status public.tracking_status default null,p_query text default '',p_sort text default 'updated',p_limit integer default 24,p_offset integer default 0) returns setof public.titles language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
  if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501'; end if;
  if p_section is null or p_section not in ('tracking','favorites','ratings') or p_sort is null or p_sort not in ('updated','title','year','rating') or p_query is null or char_length(p_query)>120 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid library query.' using errcode='23514'; end if;
  return query select t.* from public.titles t
    left join public.tracking tr on tr.title_id=t.id and tr.user_id=auth.uid()
    left join public.favorites f on f.title_id=t.id and f.user_id=auth.uid()
    left join public.ratings r on r.title_id=t.id and r.user_id=auth.uid()
    where ((p_section='tracking' and tr.id is not null and (p_status is null or tr.status=p_status)) or (p_section='favorites' and f.id is not null) or (p_section='ratings' and r.id is not null))
      and (p_query='' or t.search_document@@websearch_to_tsquery('simple',p_query) or t.display_title operator(extensions.%) p_query)
    order by case when p_sort='updated' then coalesce(tr.updated_at,f.created_at,r.updated_at) end desc,
      case when p_sort='title' then t.display_title end asc,case when p_sort='year' then t.release_year end desc nulls last,
      case when p_sort='rating' then r.score end desc nulls last,t.id limit p_limit offset p_offset;
end; $$;
create function public.title_card_data(p_ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid title page.' using errcode='23514'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,
    'genres',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name),'[]') from public.title_genres tg join public.genres g on g.id=tg.genre_id where tg.title_id=t.id),
    'poster',(select a.url from public.title_artwork a where a.title_id=t.id and a.kind='poster' order by a.created_at,a.id limit 1),
    'backdrop',(select a.url from public.title_artwork a where a.title_id=t.id and a.kind='backdrop' order by a.created_at,a.id limit 1),
    'rating',public.community_rating(t.id))),'[]') from public.titles t where t.id=any(p_ids));
end; $$;
create function public.collection_card_data(p_ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501'; end if;
  if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid collection page.' using errcode='23514'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'count',(select count(*) from public.collection_items i where i.collection_id=c.id),
    'titleIds',(select coalesce(jsonb_agg(q.title_id),'[]') from (select i.title_id from public.collection_items i where i.collection_id=c.id order by i.position,i.id limit 4) q))),'[]') from public.collections c where c.id=any(p_ids));
end; $$;
revoke all on function public.library_titles(text,public.tracking_status,text,text,integer,integer),public.title_card_data(uuid[]),public.collection_card_data(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.library_titles(text,public.tracking_status,text,text,integer,integer),public.collection_card_data(uuid[]) to authenticated;
grant execute on function public.title_card_data(uuid[]) to anon,authenticated;

do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['browse_catalog','set_favorite','create_collection_with_titles','add_titles_to_collections','set_collection_interaction','import_collection_once','mark_all_notifications_read','set_title_feedback','recommend_title_ids','save_onboarding_progress','username_available','admin_summary','admin_profiles','admin_account_action']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
end loop; end; $$;
grant execute on function public.browse_catalog(text,public.entertainment_kind,integer,uuid,text,text,numeric,text,public.catalog_status,integer,integer) to anon;
commit;
