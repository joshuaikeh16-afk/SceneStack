begin;
-- Widen a metadata allowlist; this preserves every existing valid value and row.
alter table public.collections drop constraint collections_sort_by_check;
alter table public.collections add constraint collections_sort_by_check check(sort_by in ('manual','title','release_year','added_at','rating'));
create function public.move_collection_item(p_collection uuid,p_item uuid,p_before uuid default null,p_direction integer default null) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); ids uuid[]; old_position bigint; target uuid; n integer;
begin
  perform 1 from public.collections where id=p_collection for update;
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  select position into old_position from public.collection_items where id=p_item and collection_id=p_collection;
  if not found then raise exception 'Item unavailable.' using errcode='42501'; end if;
  target:=p_before;
  if p_direction is not null then
    if p_direction not in (-1,1) then raise exception 'Invalid direction.' using errcode='23514'; end if;
    if p_direction=-1 then select id into target from public.collection_items where collection_id=p_collection and position<old_position order by position desc limit 1;
      if not found then return; end if;
    else
      select id into target from public.collection_items where collection_id=p_collection and position>old_position order by position offset 1 limit 1;
      if not exists(select 1 from public.collection_items where collection_id=p_collection and position>old_position) then return; end if;
    end if;
  end if;
  if target=p_item then return; end if;
  if target is not null and not exists(select 1 from public.collection_items where id=target and collection_id=p_collection) then raise exception 'Ordering target unavailable.' using errcode='42501'; end if;
  select coalesce(array_agg(id order by position),'{}') into ids from public.collection_items where collection_id=p_collection and id<>p_item;
  if target is null then ids:=array_append(ids,p_item);
  else n:=array_position(ids,target);ids:=coalesce(ids[1:n-1],'{}')||array[p_item]||coalesce(ids[n:cardinality(ids)],'{}');end if;
  perform public.reorder_collection_items(p_collection,ids);
  update public.collections set sort_by='manual' where id=p_collection;
end; $$;
create function public.sort_collection_items(p_collection uuid,p_sort text,p_desc boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); ids uuid[];
begin
  perform 1 from public.collections where id=p_collection for update;
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  if p_sort is null or p_sort not in ('title','release_year','added_at','rating') or p_desc is null then raise exception 'Invalid collection sort.' using errcode='23514'; end if;
  select coalesce(array_agg(q.id),'{}') into ids from (
    select i.id from public.collection_items i join public.titles t on t.id=i.title_id left join public.ratings r on r.title_id=t.id and r.user_id=who where i.collection_id=p_collection
    order by case when p_sort='title' and not p_desc then t.display_title end asc,case when p_sort='title' and p_desc then t.display_title end desc,
      case when p_sort='release_year' and not p_desc then t.release_year end asc nulls last,case when p_sort='release_year' and p_desc then t.release_year end desc nulls last,
      case when p_sort='added_at' and not p_desc then i.created_at end asc,case when p_sort='added_at' and p_desc then i.created_at end desc,
      case when p_sort='rating' and not p_desc then r.score end asc nulls last,case when p_sort='rating' and p_desc then r.score end desc nulls last,i.id
  ) q;
  perform public.reorder_collection_items(p_collection,ids);
  update public.collections set sort_by=p_sort,sort_desc=p_desc where id=p_collection;
end; $$;
create function public.set_follow(p_user uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if p_enabled is null then raise exception 'Invalid follow state.' using errcode='23514'; end if;
  if p_enabled then insert into public.follows(follower_id,followed_id) values(who,p_user) on conflict(follower_id,followed_id) do nothing;
  else delete from public.follows where follower_id=who and followed_id=p_user; end if;
end; $$;
revoke all on function public.move_collection_item(uuid,uuid,uuid,integer),public.sort_collection_items(uuid,text,boolean),public.set_follow(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.move_collection_item(uuid,uuid,uuid,integer),public.sort_collection_items(uuid,text,boolean),public.set_follow(uuid,boolean) to authenticated;
commit;
