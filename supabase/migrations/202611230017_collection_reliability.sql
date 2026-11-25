begin;
alter table public.collections add column version bigint not null default 1,add column published_at timestamptz;
create function app_private.collection_version_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then new.version:=old.version+1;end if;
 if new.visibility='published' and (tg_op='INSERT' or old.visibility<>'published') then new.published_at:=now();end if;return new;
end; $$;
create trigger collection_version_event before insert or update on public.collections for each row execute function app_private.collection_version_event();
create function app_private.collection_item_touch() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.collections set updated_at=now() where id=case when tg_op='DELETE' then old.collection_id else new.collection_id end;if tg_op='DELETE' then return old;else return new;end if;end; $$;
create trigger collection_item_touch after insert or update or delete on public.collection_items for each row execute function app_private.collection_item_touch();
create function public.update_collection_version(p_id uuid,p_version bigint,p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); c public.collections; changes public.collections;
begin
 select * into c from public.collections where id=p_id and owner_id=who and removed_at is null for update;
 if not found then raise exception 'Collection unavailable.' using errcode='42501';end if;
 if p_version is null or c.version<>p_version then raise exception 'Collection changed in another view. Reload and review your edits.' using errcode='40001';end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('title','description','visibility','spoiler_warning','cover_path')) then raise exception 'Invalid collection fields.' using errcode='23514';end if;
 select * into changes from jsonb_populate_record(c,p_patch);
 update public.collections set title=changes.title,description=changes.description,visibility=changes.visibility,spoiler_warning=changes.spoiler_warning,cover_path=changes.cover_path where id=p_id returning * into c;return to_jsonb(c);
end; $$;
create function public.collection_items_page(p_collection uuid,p_query text default '',p_category public.entertainment_kind default null,p_sort text default 'manual',p_limit integer default 48,p_offset integer default 0) returns setof public.collection_items language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_query is null or char_length(p_query)>120 or p_sort is null or p_sort not in ('manual','title','year','added','category','rating') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid collection view.' using errcode='23514';end if;
 if p_sort='rating' and not app_private.owns_collection(p_collection) then raise exception 'Personal sort unavailable.' using errcode='42501';end if;
 return query select i.* from public.collection_items i join public.titles t on t.id=i.title_id left join public.ratings r on r.user_id=auth.uid() and r.title_id=i.title_id where i.collection_id=p_collection and (p_query='' or position(lower(p_query) in lower(t.display_title))>0) and (p_category is null or t.kind=p_category)
 order by case when p_sort='manual' then i.position end,case when p_sort='title' then t.display_title end,case when p_sort='year' then t.release_year end desc nulls last,case when p_sort='added' then i.created_at end desc,case when p_sort='category' then t.kind::text end,case when p_sort='rating' then r.score end desc nulls last,i.position,i.id limit p_limit offset p_offset;
end; $$;
create function public.included_collection_titles(p_collection uuid,p_titles uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501';end if;
 if p_titles is null or cardinality(p_titles)>100 then raise exception 'Invalid title selection.' using errcode='23514';end if;
 return(select coalesce(jsonb_agg(distinct public.resolve_title(title_id)),'[]') from public.collection_items where collection_id=p_collection and public.resolve_title(title_id)=any(p_titles));
end; $$;
revoke all on function app_private.collection_version_event(),app_private.collection_item_touch(),public.update_collection_version(uuid,bigint,jsonb),public.collection_items_page(uuid,text,public.entertainment_kind,text,integer,integer),public.included_collection_titles(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.update_collection_version(uuid,bigint,jsonb),public.collection_items_page(uuid,text,public.entertainment_kind,text,integer,integer),public.included_collection_titles(uuid,uuid[]) to authenticated;
commit;
