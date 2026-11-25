begin;
create function public.edit_collection_item_version(p_collection uuid,p_item uuid,p_version bigint,p_note text default null,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); v bigint;
begin select version into v from public.collections where id=p_collection and owner_id=who for update;if not found then raise exception 'Collection unavailable.' using errcode='42501';end if;if p_version is null or p_version<>v then raise exception 'Collection changed. Review the latest version.' using errcode='40001';end if;
 if p_remove then delete from public.collection_items where id=p_item and collection_id=p_collection;else update public.collection_items set creator_note=p_note where id=p_item and collection_id=p_collection;end if;if not found then raise exception 'Item unavailable.' using errcode='42501';end if;
end; $$;
create function public.move_collection_item_version(p_collection uuid,p_item uuid,p_version bigint,p_before uuid default null,p_direction integer default null) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); v bigint;
begin select version into v from public.collections where id=p_collection and owner_id=who for update;if not found then raise exception 'Collection unavailable.' using errcode='42501';end if;if p_version is null or p_version<>v then raise exception 'Collection changed. Review the latest order.' using errcode='40001';end if;perform public.move_collection_item(p_collection,p_item,p_before,p_direction);
end; $$;
revoke all on function public.edit_collection_item_version(uuid,uuid,bigint,text,boolean),public.move_collection_item_version(uuid,uuid,bigint,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.edit_collection_item_version(uuid,uuid,bigint,text,boolean),public.move_collection_item_version(uuid,uuid,bigint,uuid,integer) to authenticated;
commit;
