begin;
create function public.collection_memberships(p_collections uuid[],p_titles uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_collections is null or cardinality(p_collections)>50 or p_titles is null or cardinality(p_titles)>100 then raise exception 'Invalid membership query.' using errcode='23514';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('collectionId',c.id,'count',(select count(distinct public.resolve_title(i.title_id)) from public.collection_items i where i.collection_id=c.id and public.resolve_title(i.title_id)=any(p_titles)))),'[]') from public.collections c where c.owner_id=auth.uid() and c.id=any(p_collections));
end; $$;
revoke all on function public.collection_memberships(uuid[],uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.collection_memberships(uuid[],uuid[]) to authenticated;
commit;
