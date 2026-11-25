begin;
-- Normalized provider identifiers for people prevent duplicate credit records.
alter table public.people add column provider_id uuid references public.metadata_providers(id),add column external_id text;
create unique index people_provider_external on public.people(provider_id,external_id) where external_id is not null;
create function app_private.protect_editorial_fields() returns trigger language plpgsql security definer set search_path='' as $$
declare field text;
begin
 if auth.uid() is not null and app_private.has_role('catalog_editor') then
  foreach field in array array['display_title','original_title','description','kind','release_year','age_rating'] loop
   if tg_op='INSERT' or to_jsonb(old)->field is distinct from to_jsonb(new)->field then insert into public.metadata_provenance(title_id,field_name,source_reference,updated_by) values(new.id,field,'manual_override',auth.uid());end if;
  end loop;
 end if;return new;
end; $$;
create trigger protect_editorial_fields after insert or update on public.titles for each row execute function app_private.protect_editorial_fields();
create function public.ingest_tmdb_title(p_provider uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare canonical uuid; existing public.titles; v public.titles; x jsonb; g uuid; person uuid; n integer:=0; related uuid; blocked_fields text[]; fresh boolean;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501';end if;
 perform 1 from public.metadata_providers where id=p_provider and key='tmdb' and enabled and approved for update;
 if not found then raise exception 'Provider not approved.' using errcode='42501';end if;
 if p_payload is null or octet_length(p_payload::text)>200000 or p_payload->>'media' not in ('movie','tv') or p_payload->>'externalId'!~'^[1-9][0-9]{0,11}$' or p_payload->>'kind' not in ('movie','series','cartoon','drama','documentary') or coalesce(p_payload->>'title','')='' then raise exception 'Invalid provider payload.' using errcode='23514';end if;
 select title_id into canonical from public.provider_title_ids where provider_id=p_provider and external_type=p_payload->>'media' and external_id=p_payload->>'externalId';
 if canonical is not null then canonical:=public.resolve_title(canonical);end if;fresh:=canonical is null;
 select * into v from jsonb_populate_record(null::public.titles,jsonb_build_object('display_title',p_payload->>'title','original_title',p_payload->>'originalTitle','kind',p_payload->>'kind','edition',p_payload->>'edition','description',coalesce(p_payload->>'description',''),'release_year',p_payload->'year','status',p_payload->>'status','age_rating',p_payload->>'ageRating','popularity',p_payload->'popularity'));
 if fresh then insert into public.titles(display_title,original_title,kind,edition,description,release_year,status,age_rating,popularity) values(v.display_title,v.original_title,v.kind,v.edition,v.description,v.release_year,v.status,v.age_rating,v.popularity) returning id into canonical;
 insert into public.provider_title_ids(title_id,provider_id,external_id,external_type) values(canonical,p_provider,p_payload->>'externalId',p_payload->>'media');
 else
 select * into existing from public.titles where id=canonical for update;
 select coalesce(array_agg(field_name),'{}') into blocked_fields from public.metadata_provenance where title_id=canonical and source_reference='manual_override';
 update public.titles set display_title=case when 'display_title'=any(blocked_fields) then existing.display_title else v.display_title end,original_title=case when 'original_title'=any(blocked_fields) then existing.original_title else v.original_title end,kind=case when 'kind'=any(blocked_fields) then existing.kind else v.kind end,description=case when 'description'=any(blocked_fields) then existing.description else v.description end,release_year=case when 'release_year'=any(blocked_fields) then existing.release_year else v.release_year end,age_rating=case when 'age_rating'=any(blocked_fields) then existing.age_rating else v.age_rating end,popularity=v.popularity,status=v.status where id=canonical;
 end if;
 -- Replace provider-owned media only inside the same transaction; failures retain the previous cache.
 delete from public.title_artwork where title_id=canonical and provider_id=p_provider;
 foreach n in array array[1,2] loop
  x:=case when n=1 then p_payload->'poster' else p_payload->'backdrop' end;
  if jsonb_typeof(x)='string' then
   if x#>>'{}'!~'^https://image[.]tmdb[.]org/t/p/(w500|w1280)/[A-Za-z0-9_-]+[.](jpg|png|webp)$' then raise exception 'Invalid artwork.' using errcode='23514';end if;
   insert into public.title_artwork(title_id,provider_id,kind,url) values(canonical,p_provider,case when n=1 then 'poster' else 'backdrop' end,x#>>'{}');
  end if;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'genres','[]')) loop
  insert into public.genres(name) values(x#>>'{}') on conflict(name) do update set name=excluded.name returning id into g;
  insert into public.title_genres(title_id,genre_id) values(canonical,g) on conflict do nothing;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'countries','[]')) loop
  insert into public.countries(code,name) values(x->>'code',x->>'name') on conflict(code) do nothing;
  insert into public.title_countries values(canonical,x->>'code') on conflict do nothing;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'languages','[]')) loop
  insert into public.languages(code,name) values(x->>'code',x->>'name') on conflict(code) do nothing;
  insert into public.title_languages values(canonical,x->>'code') on conflict do nothing;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'aliases','[]')) loop insert into public.title_names(title_id,name,name_kind) values(canonical,x#>>'{}','alternative') on conflict(title_id,name,name_kind) do nothing;end loop;
 delete from public.title_trailers where title_id=canonical and provider_id=p_provider;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'trailers','[]')) loop
  if x->>'url'!~'^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{6,30}$' then raise exception 'Invalid trailer.' using errcode='23514';end if;
  insert into public.title_trailers(title_id,provider_id,url,label) values(canonical,p_provider,x->>'url',x->>'label');
 end loop;
 n:=0;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'credits','[]')) loop
  insert into public.people(name,provider_id,external_id) values(x->>'name',p_provider,x->>'id') on conflict(provider_id,external_id) where external_id is not null do update set name=excluded.name returning id into person;
  insert into public.title_credits(title_id,person_id,department,role_name,billing_order) values(canonical,person,x->>'department',x->>'role',n) on conflict(title_id,person_id,department,role_name) do nothing;n:=n+1;
 end loop;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'related','[]')) loop
  select title_id into related from public.provider_title_ids where provider_id=p_provider and external_type=p_payload->>'media' and external_id=x#>>'{}';
  if related is not null and related<>canonical then insert into public.title_relations values(canonical,related,'other') on conflict do nothing;end if;
 end loop;
 insert into public.metadata_provenance(title_id,provider_id,field_name,source_reference) values(canonical,p_provider,'normalized_payload','https://www.themoviedb.org/'||(p_payload->>'media')||'/'||(p_payload->>'externalId'));
 perform public.record_provider_sync(canonical,p_provider,true,null);
 return canonical;
end; $$;
revoke all on function app_private.protect_editorial_fields(),public.ingest_tmdb_title(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ingest_tmdb_title(uuid,jsonb) to service_role;
commit;
