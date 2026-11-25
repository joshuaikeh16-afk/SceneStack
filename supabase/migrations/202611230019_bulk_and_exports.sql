begin;
create function public.bulk_title_actions(p_titles uuid[],p_action text,p_status public.tracking_status default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); item uuid; payload jsonb:='[]';
begin
 if p_titles is null or cardinality(p_titles) not between 1 and 100 or p_action is null or p_action not in ('track','remove','favorite') or (p_action='track' and p_status is null) then raise exception 'Invalid bulk action.' using errcode='23514';end if;
 perform 1 from public.profiles where id=who for update;
 for item in select distinct x from unnest(p_titles) x order by x loop
  begin
   perform public.change_personal_title(item,case when p_action='favorite' then 'favorite' else 'track' end,case when p_action='track' then p_status else null end,null,case when p_action='favorite' then true else null end,null);
   payload:=payload||jsonb_build_array(jsonb_build_object('titleId',item,'ok',true));
  exception when others then payload:=payload||jsonb_build_array(jsonb_build_object('titleId',item,'ok',false,'code',case when sqlstate='42501' then 'FORBIDDEN' else 'UNAVAILABLE' end));end;
 end loop;return payload;
end; $$;
revoke all on function public.bulk_title_actions(uuid[],text,public.tracking_status) from public,anon,authenticated,service_role;
grant execute on function public.bulk_title_actions(uuid[],text,public.tracking_status) to authenticated;

create or replace function public.export_personal_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result jsonb; t text; payload jsonb;
begin
  perform app_private.rate_limit('export_download',2,interval '1 hour');
  result:=jsonb_build_object('exported_at',now(),'profile',(select to_jsonb(p) from public.profiles p where p.id=who));
  foreach t in array array['onboarding','notification_preferences','recommendation_preferences','preferred_categories','favorite_genres','preferred_languages','tracking','tracking_history','ratings','rating_history','favorites','collection_imports','data_export_requests','title_feedback','recent_titles','recent_searches'] loop
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
create or replace function public.search_creators(p_query text default '',p_limit integer default 24,p_offset integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text:=lower(ltrim(p_query,'@')); payload jsonb;
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_query is null or char_length(p_query)>120 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid creator search.' using errcode='23514';end if;
 select coalesce(jsonb_agg(to_jsonb(p)),'[]') into payload from(select id,username,display_name,avatar_path,bio,cover_path,featured_collection_id,created_at from public.profiles where q='' or position(q in lower(display_name))>0 or position(q in lower(coalesce(username,'')))>0 order by display_name,id limit p_limit offset p_offset) p;return payload;
end; $$;
commit;
