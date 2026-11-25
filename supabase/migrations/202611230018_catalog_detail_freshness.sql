begin;
alter table public.titles add column release_date date,add column runtime_minutes integer check(runtime_minutes between 1 and 3000);
alter table public.metadata_providers add column allow_offline_cache boolean not null default false;
alter table public.title_relations drop constraint title_relations_relation_check;
alter table public.title_relations add constraint title_relations_relation_check check(relation in ('adaptation','sequel','prequel','season','spin_off','remake','franchise','related_series','other'));
alter table public.title_relations add column verified boolean not null default false;
create table public.production_companies(id uuid primary key default gen_random_uuid(),provider_id uuid references public.metadata_providers(id),external_id text,name text not null check(char_length(name) between 1 and 200),country_code text references public.countries(code),unique(provider_id,external_id));
create table public.title_companies(title_id uuid references public.titles(id) on delete cascade,company_id uuid references public.production_companies(id),primary key(title_id,company_id));
alter table public.production_companies enable row level security;alter table public.title_companies enable row level security;
revoke all on public.production_companies,public.title_companies from public,anon,authenticated;
grant select on public.production_companies,public.title_companies to anon,authenticated;
grant all on public.production_companies,public.title_companies to service_role;
create policy production_companies_read on public.production_companies for select to anon,authenticated using(true);
create policy title_companies_read on public.title_companies for select to anon,authenticated using(true);
create trigger audit_catalog after insert or update or delete on public.production_companies for each row execute function app_private.audit_catalog_change();
create trigger audit_catalog after insert or update or delete on public.title_companies for each row execute function app_private.audit_catalog_change();
create function public.catalog_title_extras(p_title uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('aliases',(select coalesce(jsonb_agg(name order by name),'[]') from public.title_names where title_id=p_title),'countries',(select coalesce(jsonb_agg(c.name order by c.name),'[]') from public.title_countries tc join public.countries c on c.code=tc.country_code where tc.title_id=p_title),'languages',(select coalesce(jsonb_agg(l.name order by l.name),'[]') from public.title_languages tl join public.languages l on l.code=tl.language_code where tl.title_id=p_title),'companies',(select coalesce(jsonb_agg(c.name order by c.name),'[]') from public.title_companies tc join public.production_companies c on c.id=tc.company_id where tc.title_id=p_title),'warnings',(select coalesce(jsonb_agg(w.label order by w.label),'[]') from public.title_content_warnings tw join public.content_warnings w on w.id=tw.warning_id where tw.title_id=p_title));
$$;
create function public.catalog_freshness(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid metadata page.' using errcode='23514';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'lastSuccessAt',q.last_success,'stale',q.stale)),'[]') from(select t.id,max(s.last_success_at) last_success,bool_or(s.state='failed' or s.last_success_at<now()-interval '7 days') stale from public.titles t left join public.provider_sync_state s on s.title_id=t.id where t.id=any(p_ids) group by t.id) q);
end; $$;
create function public.public_title_cache_allowed(p_title uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.provider_title_ids where title_id=p_title) and not exists(select 1 from public.provider_title_ids i join public.metadata_providers p on p.id=i.provider_id where i.title_id=p_title and not(p.approved and p.enabled and p.allow_offline_cache));
$$;
create function public.verify_title_relationship(p_source uuid,p_related uuid,p_relation text) returns void language plpgsql security definer set search_path='' as $$
begin if not app_private.has_role('catalog_editor') then raise exception 'Catalog access unavailable.' using errcode='42501';end if;
 insert into public.title_relations(source_id,related_id,relation,verified) values(p_source,p_related,p_relation,true) on conflict(source_id,related_id,relation) do update set verified=true;
end; $$;
-- Wrap the approved transactional ingest to add supplementary metadata. The base
-- remains non-exposed and retains all approval/identity and editorial protections.
alter function public.ingest_tmdb_title(uuid,jsonb) rename to ingest_tmdb_base;
alter function public.ingest_tmdb_base(uuid,jsonb) set schema app_private;
revoke all on function app_private.ingest_tmdb_base(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.ingest_tmdb_title(p_provider uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare canonical uuid; x jsonb; company uuid;
begin
 canonical:=app_private.ingest_tmdb_base(p_provider,p_payload);
 update public.titles set release_date=case when p_payload ? 'releaseDate' then (p_payload->>'releaseDate')::date else release_date end,runtime_minutes=case when p_payload ? 'runtime' then (p_payload->>'runtime')::integer else runtime_minutes end where id=canonical;
 for x in select value from jsonb_array_elements(coalesce(p_payload->'companies','[]')) loop
  insert into public.production_companies(provider_id,external_id,name) values(p_provider,x->>'id',x->>'name') on conflict(provider_id,external_id) do update set name=excluded.name returning id into company;
  insert into public.title_companies values(canonical,company) on conflict do nothing;
 end loop;return canonical;
end; $$;
revoke all on function public.catalog_title_extras(uuid),public.catalog_freshness(uuid[]),public.public_title_cache_allowed(uuid),public.verify_title_relationship(uuid,uuid,text),public.ingest_tmdb_title(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.catalog_title_extras(uuid),public.catalog_freshness(uuid[]),public.public_title_cache_allowed(uuid) to anon,authenticated;
grant execute on function public.verify_title_relationship(uuid,uuid,text) to authenticated;
grant execute on function public.ingest_tmdb_title(uuid,jsonb) to service_role;
commit;
