begin;
create index title_countries_filter on public.title_countries(country_code,title_id);
create index title_languages_filter on public.title_languages(language_code,title_id);
create index credits_person on public.title_credits(person_id,title_id);
create index reports_reporter on public.reports(reporter_id,created_at desc,id);
create index submissions_owner on public.missing_title_requests(user_id,created_at desc,id);
create index corrections_owner on public.metadata_corrections(user_id,created_at desc,id);
create index imports_source_owner on public.collection_imports(source_owner_id);
create index notifications_actor on public.notifications(actor_id);
create index notifications_collection on public.notifications(collection_id);
create index collection_items_title on public.collection_items(title_id);

create function public.search_catalog(p_query text default '',p_category public.entertainment_kind default null,p_year integer default null,p_genre uuid default null,p_language text default null,p_country text default null,p_min_rating numeric default null,p_sort text default 'title',p_limit integer default 24,p_offset integer default 0) returns setof public.titles language plpgsql stable security invoker set search_path='' as $$
begin
  if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501'; end if;
  if p_query is null or char_length(p_query)>120 or p_query ~ '[[:cntrl:]]' or p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 or p_offset>1000000 or p_sort is null or p_sort not in ('title','year','added') or (p_year is not null and p_year not between 1888 and 2200) or (p_min_rating is not null and (p_min_rating<1 or p_min_rating>10)) then raise exception 'Invalid catalog query.' using errcode='23514'; end if;
  return query select t.* from public.titles t where t.status<>'merged'
    and (p_category is null or t.kind=p_category) and (p_year is null or t.release_year=p_year)
    and (p_query='' or t.search_document@@websearch_to_tsquery('simple',p_query) or exists(select 1 from public.title_names n where n.title_id=t.id and n.search_document@@websearch_to_tsquery('simple',p_query)))
    and (p_genre is null or exists(select 1 from public.title_genres g where g.title_id=t.id and g.genre_id=p_genre))
    and (p_language is null or exists(select 1 from public.title_languages l where l.title_id=t.id and l.language_code=p_language))
    and (p_country is null or exists(select 1 from public.title_countries c where c.title_id=t.id and c.country_code=p_country))
    and (p_min_rating is null or (public.community_rating(t.id)->>'score')::numeric>=p_min_rating)
    order by case when p_sort='title' then t.display_title end asc,case when p_sort='year' then t.release_year end desc nulls last,case when p_sort='added' then t.created_at end desc,t.id asc limit p_limit offset p_offset;
end; $$;
revoke all on function public.search_catalog(text,public.entertainment_kind,integer,uuid,text,text,numeric,text,integer,integer) from public,anon,authenticated;
grant execute on function public.search_catalog(text,public.entertainment_kind,integer,uuid,text,text,numeric,text,integer,integer) to authenticated;
grant select on public.provider_title_ids to anon,authenticated;
create policy external_reference_read on public.provider_title_ids for select to anon,authenticated using(true);
grant select(id,title_id,provider_id,field_name,source_reference,retrieved_at) on public.metadata_provenance to anon,authenticated;
create policy provenance_read on public.metadata_provenance for select to anon,authenticated using(true);

-- Relational rows retain their identity even when an owner is allowed to edit content.
create function app_private.guard_immutable_edges() returns trigger language plpgsql set search_path='' as $$
begin
  if new.id<>old.id then raise exception 'Record identity is permanent.' using errcode='23514'; end if;
  if tg_table_name in ('tracking','ratings') then
    if new.user_id<>old.user_id or new.title_id<>old.title_id then raise exception 'Record ownership is permanent.' using errcode='23514'; end if;
  elsif tg_table_name='collection_items' then
    if new.collection_id<>old.collection_id or new.title_id<>old.title_id then raise exception 'Collection membership is permanent.' using errcode='23514'; end if;
  end if;
  return new;
end; $$;
create trigger tracking_immutable before update on public.tracking for each row execute function app_private.guard_immutable_edges();
create trigger ratings_immutable before update on public.ratings for each row execute function app_private.guard_immutable_edges();
create trigger collection_item_immutable before update on public.collection_items for each row execute function app_private.guard_immutable_edges();
revoke all on function app_private.guard_immutable_edges() from public,anon,authenticated;
-- Admin-created lookup/filter changes are audited as well as core title edits.
do $$ declare t text; begin foreach t in array array['countries','languages','title_countries','title_languages','metadata_refresh_requests','provider_sync_state'] loop
  execute format('create trigger audit_catalog after insert or update or delete on public.%I for each row execute function app_private.audit_catalog_change()',t);
end loop; end; $$;
-- Trusted jobs cannot bypass the audited role-management or notification paths.
revoke insert,update,delete on public.admin_roles,public.audit_logs,public.notifications from service_role;
revoke all on app_private.platform_owner from service_role;
revoke insert,update,delete on public.title_redirects from service_role;
-- Ordinary maintenance jobs have no reason to read private libraries or preferences.
revoke all on public.tracking,public.tracking_history,public.ratings,public.rating_history,public.favorites,public.onboarding,public.notification_preferences,public.recommendation_preferences,public.preferred_categories,public.favorite_genres,public.preferred_languages,public.collection_favorites,public.collection_saves,public.collection_imports from service_role;
-- Resolve reviewed duplicates without deleting any private personal reference.
-- If a member rated both editions before a reviewed merge, use their latest
-- eligible rating once; merging must never inflate the community voter count.
create or replace function public.community_rating(p_title uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare total bigint; average numeric; canonical uuid:=public.resolve_title(p_title);
begin
  with family as (
    select canonical id where canonical is not null
    union select source_id from public.title_redirects where target_id=canonical
  ), eligible as (
    select distinct on (r.user_id) r.user_id,r.score
    from public.ratings r join family f on f.id=r.title_id join public.profiles p on p.id=r.user_id
    where r.eligible and p.status='active' order by r.user_id,r.updated_at desc,r.id desc
  ) select count(*),case when count(*)>=5 then round(avg(score),1) else null end into total,average from eligible;
  return jsonb_build_object('score',average,'voteCount',total,'minimumVotes',5);
end; $$;
revoke all on function public.community_rating(uuid) from public,anon,authenticated;
grant execute on function public.community_rating(uuid) to anon,authenticated;

revoke create on schema public from public,anon,authenticated;
commit;
