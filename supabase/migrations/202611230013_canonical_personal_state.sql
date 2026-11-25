begin;
-- Canonical reads preserve old references after a merge. Only an explicit user edit
-- consolidates that user's current values; histories remain intact.
create function public.personal_title_states(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); payload jsonb;
begin
 if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid title page.' using errcode='23514';end if;
 select coalesce(jsonb_agg(jsonb_build_object('titleId',q.input,'tracking',(select tr.status from public.tracking tr where tr.user_id=who and public.resolve_title(tr.title_id)=q.canonical order by tr.updated_at desc,tr.id desc limit 1),'favorite',exists(select 1 from public.favorites f where f.user_id=who and public.resolve_title(f.title_id)=q.canonical),'rating',(select r.score from public.ratings r where r.user_id=who and public.resolve_title(r.title_id)=q.canonical order by r.updated_at desc,r.id desc limit 1))),'[]') into payload from(select x input,public.resolve_title(x) canonical from unnest(p_ids) x) q;
 return payload;
end; $$;
create function public.change_personal_title(p_title uuid,p_action text,p_status public.tracking_status default null,p_rating numeric default null,p_enabled boolean default null,p_feedback text default null) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); canonical uuid:=public.resolve_title(p_title);
begin
 if canonical is null or p_action is null or p_action not in ('track','rate','favorite','feedback') then raise exception 'Invalid title action.' using errcode='23514';end if;
 perform 1 from public.profiles where id=who for update;
 if p_action='track' then
  delete from public.tracking where user_id=who and public.resolve_title(title_id)=canonical and (p_status is null or title_id<>canonical);
  if p_status is not null then perform public.set_tracking(canonical,p_status);end if;
 elsif p_action='rate' then
  delete from public.ratings where user_id=who and public.resolve_title(title_id)=canonical and (p_rating is null or title_id<>canonical);
  if p_rating is not null then perform public.set_rating(canonical,p_rating);end if;
 elsif p_action='favorite' then
  if p_enabled is null then raise exception 'Invalid favorite state.' using errcode='23514';end if;
  delete from public.favorites where user_id=who and public.resolve_title(title_id)=canonical and (not p_enabled or title_id<>canonical);
  perform public.set_favorite(canonical,p_enabled);
 else perform public.set_title_feedback(canonical,p_feedback);end if;
end; $$;
create or replace function public.library_titles(p_section text default 'tracking',p_status public.tracking_status default null,p_query text default '',p_sort text default 'updated',p_limit integer default 24,p_offset integer default 0) returns setof public.titles language plpgsql stable security invoker set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_section is null or p_section not in ('tracking','favorites','ratings') or p_query is null or char_length(p_query)>120 or p_sort is null or p_sort not in ('updated','title','year','rating') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid library query.' using errcode='23514';end if;
 return query select t.* from public.titles t
 left join lateral(select tr.status,tr.updated_at from public.tracking tr where tr.user_id=who and public.resolve_title(tr.title_id)=t.id order by tr.updated_at desc,tr.id desc limit 1) tr on true
 left join lateral(select r.score,r.updated_at from public.ratings r where r.user_id=who and public.resolve_title(r.title_id)=t.id order by r.updated_at desc,r.id desc limit 1) r on true
 left join lateral(select f.created_at from public.favorites f where f.user_id=who and public.resolve_title(f.title_id)=t.id order by f.created_at desc,f.id desc limit 1) f on true
 where t.status<>'merged' and (p_section='tracking' and tr.status is not null and (p_status is null or tr.status=p_status) or p_section='favorites' and f.created_at is not null or p_section='ratings' and r.score is not null)
 and (p_query='' or t.search_document@@websearch_to_tsquery('simple',p_query) or t.display_title operator(extensions.%) p_query)
 order by case when p_sort='updated' then coalesce(tr.updated_at,f.created_at,r.updated_at) end desc,case when p_sort='title' then t.display_title end asc,case when p_sort='year' then t.release_year end desc nulls last,case when p_sort='rating' then r.score end desc nulls last,t.id limit p_limit offset p_offset;
end; $$;
create function public.blocked_accounts(p_limit integer default 24,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); payload jsonb;
begin
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid page.' using errcode='23514';end if;
 select coalesce(jsonb_agg(jsonb_build_object('blocked_id',q.blocked_id,'created_at',q.created_at,'display_name',q.display_name,'username',q.username)),'[]') into payload from(select b.blocked_id,b.created_at,p.display_name,p.username from public.blocks b join public.profiles p on p.id=b.blocked_id where b.blocker_id=who order by b.created_at desc,b.id limit p_limit offset p_offset) q;return payload;
end; $$;
revoke all on function public.personal_title_states(uuid[]),public.change_personal_title(uuid,text,public.tracking_status,numeric,boolean,text),public.blocked_accounts(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.personal_title_states(uuid[]),public.change_personal_title(uuid,text,public.tracking_status,numeric,boolean,text),public.blocked_accounts(integer,integer) to authenticated;
commit;
