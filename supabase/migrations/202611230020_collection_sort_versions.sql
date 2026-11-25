begin;
alter table public.collections drop constraint collections_sort_by_check;
alter table public.collections add constraint collections_sort_by_check check(sort_by in ('manual','title','release_year','added_at','rating','category'));
create or replace function public.sort_collection_items(p_collection uuid,p_sort text,p_desc boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); ids uuid[];
begin
  perform 1 from public.collections where id=p_collection for update;
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  if p_sort is null or p_sort not in ('title','release_year','added_at','rating','category') or p_desc is null then raise exception 'Invalid collection sort.' using errcode='23514'; end if;
  select coalesce(array_agg(q.id),'{}') into ids from (
    select i.id from public.collection_items i join public.titles t on t.id=i.title_id left join public.ratings r on r.title_id=t.id and r.user_id=who where i.collection_id=p_collection
    order by case when p_sort='category' and not p_desc then t.kind::text end asc,case when p_sort='category' and p_desc then t.kind::text end desc,case when p_sort='title' and not p_desc then t.display_title end asc,case when p_sort='title' and p_desc then t.display_title end desc,
      case when p_sort='release_year' and not p_desc then t.release_year end asc nulls last,case when p_sort='release_year' and p_desc then t.release_year end desc nulls last,
      case when p_sort='added_at' and not p_desc then i.created_at end asc,case when p_sort='added_at' and p_desc then i.created_at end desc,
      case when p_sort='rating' and not p_desc then r.score end asc nulls last,case when p_sort='rating' and p_desc then r.score end desc nulls last,i.id
  ) q;
  perform public.reorder_collection_items(p_collection,ids);
  update public.collections set sort_by=p_sort,sort_desc=p_desc where id=p_collection;
end; $$;
create function public.save_collection_order(p_collection uuid,p_version bigint,p_sort text,p_desc boolean) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); current_version bigint;
begin select version into current_version from public.collections where id=p_collection and owner_id=who for update;
 if not found then raise exception 'Collection unavailable.' using errcode='42501';end if;if p_version is null or p_version<>current_version then raise exception 'Collection changed. Review the latest order.' using errcode='40001';end if;perform public.sort_collection_items(p_collection,p_sort,p_desc);
end; $$;
revoke all on function public.save_collection_order(uuid,bigint,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_collection_order(uuid,bigint,text,boolean) to authenticated;
commit;
