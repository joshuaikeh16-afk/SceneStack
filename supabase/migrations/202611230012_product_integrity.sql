begin;
create function public.library_collections(p_section text default 'collections',p_query text default '',p_sort text default 'updated',p_limit integer default 24,p_offset integer default 0) returns setof public.collections language plpgsql stable security invoker set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_section is null or p_section not in ('collections','saved','imported') or p_query is null or char_length(p_query)>120 or p_sort is null or p_sort not in ('updated','title','year','rating') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid library query.' using errcode='23514';end if;
 return query select c.* from public.collections c where (p_section='collections' and c.owner_id=who or p_section='saved' and exists(select 1 from public.collection_saves s where s.user_id=who and s.collection_id=c.id) or p_section='imported' and exists(select 1 from public.collection_imports i where i.user_id=who and i.imported_collection_id=c.id)) and (p_query='' or position(lower(p_query) in lower(c.title))>0)
 order by case when p_sort='title' then c.title end,case when p_sort<>'title' then c.updated_at end desc,c.id limit p_limit offset p_offset;
end; $$;
revoke all on function public.library_collections(text,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.library_collections(text,text,text,integer,integer) to authenticated;
create or replace function public.set_title_feedback(p_title uuid,p_feedback text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
 if p_feedback is null or p_feedback not in ('not_interested','already_seen') then raise exception 'Invalid feedback.' using errcode='23514';end if;
 perform app_private.rate_limit('recommendation_feedback',300,interval '1 hour');
 insert into public.title_feedback(user_id,title_id,feedback) values(who,p_title,p_feedback) on conflict(user_id,title_id) do update set feedback=excluded.feedback;
end; $$;

create or replace function public.export_personal_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result jsonb; t text; payload jsonb;
begin
  perform app_private.rate_limit('export_download',2,interval '1 hour');
  result:=jsonb_build_object('exported_at',now(),'profile',(select to_jsonb(p) from public.profiles p where p.id=who));
  foreach t in array array['onboarding','notification_preferences','recommendation_preferences','preferred_categories','favorite_genres','preferred_languages','tracking','tracking_history','ratings','rating_history','favorites','collection_imports','data_export_requests','title_feedback'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where user_id=$1',t) into payload using who;
    result:=result||jsonb_build_object(t,payload);
  end loop;
  result:=result||jsonb_build_object(
    'collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.collections c where owner_id=who),
    'collection_items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.collection_items i join public.collections c on c.id=i.collection_id where c.owner_id=who),
    'collection_saves',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_saves s where user_id=who and app_private.can_read_collection(collection_id)),
    'collection_favorites',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_favorites s where user_id=who and app_private.can_read_collection(collection_id)),
    'follows',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.follows f where follower_id=who),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.blocks b where blocker_id=who),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.notifications n where recipient_id=who and app_private.can_interact(actor_id) and (collection_id is null or app_private.can_read_collection(collection_id))),
    'reports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'details',details,'status',status,'created_at',created_at)),'[]') from public.reports where reporter_id=who));
  return result;
end; $$;

create or replace function public.recommend_title_ids(p_limit integer default 24) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); payload jsonb; prefs public.recommendation_preferences;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size.' using errcode='23514';end if;
 select * into prefs from public.recommendation_preferences where user_id=who;if not prefs.enabled then return '[]';end if;
 with signals as (select t.id,t.display_title,t.popularity,
  (select g.name from public.title_genres tg join public.favorite_genres fg on fg.genre_id=tg.genre_id and fg.user_id=who join public.genres g on g.id=tg.genre_id where tg.title_id=t.id order by g.name limit 1) genre,
  exists(select 1 from public.preferred_categories c where c.user_id=who and c.category=t.kind) category,
  exists(select 1 from public.title_genres tg join public.title_genres sg on sg.genre_id=tg.genre_id where tg.title_id=t.id and (exists(select 1 from public.favorites f where f.user_id=who and f.title_id=sg.title_id) or exists(select 1 from public.ratings r where r.user_id=who and r.title_id=sg.title_id and r.score>=7))) favorites,
  exists(select 1 from public.title_genres tg join public.title_genres sg on sg.genre_id=tg.genre_id join public.tracking tr on tr.title_id=sg.title_id and tr.user_id=who and tr.status in ('planned','watching','on_hold') where tg.title_id=t.id) tracking,
  exists(select 1 from public.collection_items i join public.collections c on c.id=i.collection_id join public.follows f on f.followed_id=c.owner_id and f.follower_id=who where i.title_id=t.id and c.visibility='published' and app_private.can_read_collection(c.id)) followed
  from public.titles t where t.status<>'merged' and not exists(select 1 from public.title_feedback f where f.user_id=who and public.resolve_title(f.title_id)=t.id)
  and not exists(select 1 from public.tracking tr where tr.user_id=who and public.resolve_title(tr.title_id)=t.id and tr.status in ('completed','dropped'))
  and (coalesce(t.age_rating,'') not in ('R','NC-17','18','TV-MA') or prefs.include_mature)
 ),ranked as(select *,case when genre is not null then 5 else 0 end+case when category then 3 else 0 end+case when favorites then 2 else 0 end+case when tracking then 2 else 0 end+case when followed then 3 else 0 end relevancy from signals)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',case when genre is not null then 'Because you enjoy '||lower(genre)||'.' when followed then 'From a published collection by a creator you follow.' when favorites then 'Related to your own favorites and highly rated titles.' when tracking then 'Related to titles in your private library.' when category then 'From a category you enjoy.' else 'A little room for something different.' end)),'[]') into payload
 from(select * from ranked where prefs.diversify or relevancy>0 order by relevancy desc,popularity desc nulls last,display_title,id limit p_limit) q;
 return payload;
end; $$;
commit;
