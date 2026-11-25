begin;
alter table public.metadata_providers add column bulk_approved boolean not null default false;
alter table public.profiles add column verified_at timestamptz;
alter table public.profiles add column verified_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column username_change_required boolean not null default false;

create table public.platform_settings (
  singleton boolean primary key default true check(singleton),
  settings jsonb not null default '{"maintenance":false,"registration":true,"community":true,"ingestionBatchSize":10,"requestsPerMinute":30}',
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id),
  check(jsonb_typeof(settings)='object' and octet_length(settings::text)<=10000)
);
insert into public.platform_settings(singleton) values(true);
create table public.control_documents (
  id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('help','editorial','announcement')),
  slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),title text not null check(char_length(btrim(title)) between 1 and 200),
  category text not null default 'general' check(char_length(category)<=100),body text not null default '' check(char_length(body)<=30000),
  content jsonb not null default '{}' check(jsonb_typeof(content)='object' and octet_length(content::text)<=50000),
  status text not null default 'draft' check(status in ('draft','published','withdrawn')),
  audience text not null default 'public' check(audience in ('public','members','administrators')),
  starts_at timestamptz,expires_at timestamptz,version integer not null default 1 check(version>0),
  created_by uuid references public.profiles(id),updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(kind,slug),check(expires_at is null or starts_at is null or expires_at>starts_at)
);
create index control_documents_live on public.control_documents(kind,status,starts_at,expires_at);
create table public.control_document_revisions (
  id uuid primary key default gen_random_uuid(),document_id uuid not null references public.control_documents(id) on delete restrict,
  version integer not null,snapshot jsonb not null,actor_id uuid references public.profiles(id),reason text not null,
  created_at timestamptz not null default now(),unique(document_id,version)
);
create table public.document_dismissals (
  document_id uuid references public.control_documents(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(document_id,user_id)
);
create table public.metadata_locks (
  title_id uuid not null references public.titles(id) on delete restrict,field_name text not null,
  locked boolean not null default true,updated_by uuid references public.profiles(id),updated_at timestamptz not null default now(),
  primary key(title_id,field_name),check(field_name in ('display_title','original_title','description','kind','edition','status','release_year','release_date','runtime_minutes','age_rating','genres','countries','languages','aliases','poster','backdrop'))
);
create table public.metadata_revisions (
  id uuid primary key default gen_random_uuid(),title_id uuid not null references public.titles(id) on delete restrict,
  actor_id uuid references public.profiles(id),reason text not null check(char_length(btrim(reason)) between 1 and 3000),
  previous_state jsonb not null,next_state jsonb not null,created_at timestamptz not null default now()
);
create index metadata_revisions_title on public.metadata_revisions(title_id,created_at desc,id);
create table public.correction_field_decisions (
  case_id uuid references public.control_cases(id) on delete cascade,field_name text,
  approved boolean not null,reason text not null,decided_by uuid references public.profiles(id),decided_at timestamptz not null default now(),
  primary key(case_id,field_name)
);
create table public.catalog_jobs (
  id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.metadata_providers(id),
  kind text not null check(kind in ('initial','historical','popular','trending','recent','upcoming','refresh')),
  state text not null default 'queued' check(state in ('queued','running','paused','completed','failed','cancelled')),
  query jsonb not null default '{}' check(jsonb_typeof(query)='object' and octet_length(query::text)<=4000),
  checkpoint jsonb not null default '{}' check(jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=4000),
  processed integer not null default 0 check(processed>=0),imported integer not null default 0 check(imported>=0),updated integer not null default 0 check(updated>=0),
  skipped integer not null default 0 check(skipped>=0),failed integer not null default 0 check(failed>=0),estimated_total integer check(estimated_total>=0),
  attempts integer not null default 0,max_attempts integer not null default 8 check(max_attempts between 1 and 20),
  lease_token uuid,lease_expires_at timestamptz,available_at timestamptz not null default now(),last_error text check(char_length(last_error)<=120),
  created_by uuid references public.profiles(id),created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,updated_at timestamptz not null default now()
);
create index catalog_jobs_claim on public.catalog_jobs(state,available_at,lease_expires_at,created_at);
create unique index catalog_one_running_provider on public.catalog_jobs(provider_id) where state='running';
create table public.catalog_job_failures (
  id uuid primary key default gen_random_uuid(),job_id uuid not null references public.catalog_jobs(id) on delete cascade,
  source text not null check(source in ('tmdb.movie','tmdb.tv','myanimelist.anime')),
  external_id text not null check(external_id ~ '^[1-9][0-9]{0,11}$'),code text not null check(char_length(code)<=120),
  attempts integer not null default 1,created_at timestamptz not null default now(),resolved_at timestamptz,
  unique(job_id,source,external_id)
);
create table public.catalog_schedules (
  id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.metadata_providers(id),
  name text not null check(char_length(name) between 1 and 120),kind text not null check(kind in ('historical','popular','trending','recent','upcoming','refresh')),
  query jsonb not null default '{}' check(jsonb_typeof(query)='object' and octet_length(query::text)<=4000),
  interval_minutes integer not null check(interval_minutes between 60 and 10080),enabled boolean not null default false,
  next_run_at timestamptz not null default now(),last_job_id uuid references public.catalog_jobs(id),updated_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
create table app_private.provider_budgets (
  provider_id uuid references public.metadata_providers(id) on delete cascade,window_start timestamptz,units integer not null default 0,
  primary key(provider_id,window_start)
);
create table public.platform_daily_metrics (
  day date primary key,registered_users integer not null default 0,catalog_titles integer not null default 0,published_collections integer not null default 0,
  collection_favorites integer not null default 0,collection_saves integer not null default 0,collection_imports integer not null default 0,
  captured_at timestamptz not null default now()
);
create table public.search_daily_metrics (
  day date not null,query text not null check(char_length(query)<=120),category text not null default '',searches integer not null default 0,no_results integer not null default 0,
  primary key(day,query,category)
);
do $$ declare item text; begin
  foreach item in array array['platform_settings','control_documents','control_document_revisions','document_dismissals','metadata_locks','metadata_revisions','correction_field_decisions','catalog_jobs','catalog_job_failures','catalog_schedules','platform_daily_metrics','search_daily_metrics'] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('revoke all on public.%I from public,anon,authenticated',item);
    execute format('grant select on public.%I to authenticated',item);
    execute format('grant all on public.%I to service_role',item);
  end loop;
end; $$;
alter table app_private.provider_budgets enable row level security;
revoke all on app_private.provider_budgets from public,anon,authenticated;
grant all on app_private.provider_budgets to service_role;
grant select on public.control_documents to anon;
create policy settings_read on public.platform_settings for select to authenticated using(app_private.has_role('super_admin'));
create policy documents_read on public.control_documents for select to anon,authenticated using(app_private.has_role('super_admin') or (status='published' and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()) and (audience='public' or (audience='members' and app_private.member()) or (audience='administrators' and app_private.has_role('moderator')))));
create policy document_revisions_read on public.control_document_revisions for select to authenticated using(app_private.has_role('super_admin'));
create policy dismissals_read on public.document_dismissals for select to authenticated using(user_id=auth.uid());
do $$ declare item text; begin
  foreach item in array array['metadata_locks','metadata_revisions','correction_field_decisions','catalog_jobs','catalog_job_failures','catalog_schedules','platform_daily_metrics','search_daily_metrics'] loop
    execute format('create policy control_owner_read on public.%I for select to authenticated using(app_private.has_role(''super_admin''))',item);
  end loop;
end; $$;

create function public.control_save_settings(p_settings jsonb,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare old_settings jsonb; item text;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Settings unavailable.' using errcode='42501'; end if;
  if jsonb_typeof(p_settings)<>'object' then raise exception 'Invalid settings.' using errcode='23514'; end if;
  for item in select jsonb_object_keys(p_settings) loop
    if item not in ('maintenance','registration','community','ingestionBatchSize','requestsPerMinute','supportWelcome') then raise exception 'Unsupported setting.' using errcode='23514'; end if;
    if item in ('maintenance','registration','community') and jsonb_typeof(p_settings->item)<>'boolean' then raise exception 'Invalid feature setting.' using errcode='23514'; end if;
  end loop;
  if p_settings ? 'ingestionBatchSize' and (p_settings->>'ingestionBatchSize')::integer not between 1 and 20 then raise exception 'Invalid batch size.' using errcode='23514'; end if;
  if p_settings ? 'requestsPerMinute' and (p_settings->>'requestsPerMinute')::integer not between 1 and 90 then raise exception 'Invalid rate limit.' using errcode='23514'; end if;
  select settings into old_settings from public.platform_settings where singleton for update;
  update public.platform_settings set settings=settings||p_settings,updated_by=auth.uid(),updated_at=now() where singleton;
  perform app_private.control_audit('settings_changed','platform',null,p_reason,old_settings,p_settings);
end; $$;
create function app_private.maintenance_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not app_private.has_role('moderator') and exists(select 1 from public.platform_settings where singleton and settings->>'maintenance'='true') then raise exception 'SceneStack is undergoing maintenance. Essential support and account access remain available.' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
do $$ declare item text; begin
  foreach item in array array['tracking','ratings','favorites','follows','collections','collection_items','collection_favorites','collection_saves','collection_imports','missing_title_requests','metadata_corrections','reports'] loop
    execute format('create trigger control_maintenance_guard before insert or update or delete on public.%I for each row execute function app_private.maintenance_guard()',item);
  end loop;
end; $$;

create function public.control_save_document(p_id uuid,p_kind text,p_values jsonb,p_version integer,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.control_documents; result uuid; item jsonb;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Publication unavailable.' using errcode='42501'; end if;
  if jsonb_typeof(p_values)<>'object' or p_values ?| array['created_by','updated_by','version','id'] then raise exception 'Invalid document fields.' using errcode='23514'; end if;
  if p_values->>'status'='published' and p_kind='editorial' then
    for item in select value from jsonb_array_elements(coalesce(p_values->'content'->'sections','[]')) loop
      if coalesce(item->>'type','') not in ('titles','category','collections','personalized') or jsonb_typeof(item->'titleIds') not in ('array','null') then raise exception 'Invalid editorial section.' using errcode='23514'; end if;
      if item ? 'titleIds' and exists(select 1 from jsonb_array_elements_text(item->'titleIds') v where not exists(select 1 from public.titles where id=v::uuid and status not in ('merged','unavailable'))) then raise exception 'Editorial title is unavailable.' using errcode='23514'; end if;
    end loop;
  end if;
  if p_id is null then
    insert into public.control_documents(kind,slug,title,category,body,content,status,audience,starts_at,expires_at,created_by,updated_by)
    values(p_kind,p_values->>'slug',p_values->>'title',coalesce(p_values->>'category','general'),coalesce(p_values->>'body',''),coalesce(p_values->'content','{}'),coalesce(p_values->>'status','draft'),coalesce(p_values->>'audience','public'),nullif(p_values->>'starts_at','')::timestamptz,nullif(p_values->>'expires_at','')::timestamptz,auth.uid(),auth.uid()) returning id into result;
  else
    select * into existing from public.control_documents where id=p_id and kind=p_kind for update;
    if not found or existing.version<>p_version then raise exception 'Document changed. Reload before saving.' using errcode='40001'; end if;
    insert into public.control_document_revisions(document_id,version,snapshot,actor_id,reason) values(p_id,existing.version,to_jsonb(existing),auth.uid(),p_reason);
    update public.control_documents set slug=coalesce(p_values->>'slug',slug),title=coalesce(p_values->>'title',title),category=coalesce(p_values->>'category',category),body=coalesce(p_values->>'body',body),content=coalesce(p_values->'content',content),status=coalesce(p_values->>'status',status),audience=coalesce(p_values->>'audience',audience),starts_at=case when p_values ? 'starts_at' then nullif(p_values->>'starts_at','')::timestamptz else starts_at end,expires_at=case when p_values ? 'expires_at' then nullif(p_values->>'expires_at','')::timestamptz else expires_at end,version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id;
    result:=p_id;
  end if;
  perform app_private.control_audit('document_saved',p_kind,result,p_reason,to_jsonb(existing),p_values);
  return result;
end; $$;
create function public.control_rollback_document(p_revision uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare revision public.control_document_revisions; current_version integer;
begin
  if not app_private.has_role('super_admin') then raise exception 'Rollback unavailable.' using errcode='42501'; end if;
  select * into revision from public.control_document_revisions where id=p_revision;
  if not found then raise exception 'Revision not found.' using errcode='23514'; end if;
  select version into current_version from public.control_documents where id=revision.document_id;
  return public.control_save_document(revision.document_id,revision.snapshot->>'kind',revision.snapshot-array['id','version','created_by','created_at','updated_by','updated_at'],current_version,p_reason);
end; $$;
create function public.dismiss_control_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_member();
  if not exists(select 1 from public.control_documents where id=p_id and kind='announcement' and status='published') then raise exception 'Announcement unavailable.' using errcode='23514'; end if;
  insert into public.document_dismissals values(p_id,auth.uid(),now()) on conflict do nothing;
end; $$;

create function public.control_catalog_job(p_id uuid,p_action text,p_provider uuid default null,p_kind text default 'popular',p_query jsonb default '{}',p_reason text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare item public.catalog_jobs; result uuid;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Job operation unavailable.' using errcode='42501'; end if;
  if p_action='create' then
    if not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled and bulk_approved) then raise exception 'Bulk ingestion permission has not been confirmed.' using errcode='42501'; end if;
    if p_query->>'category' not in ('movie','series','anime','cartoon','drama','documentary') or (p_query->>'yearStart')::integer not between 1888 and 2200 or (p_query->>'yearEnd')::integer not between 1888 and 2200 or (p_query->>'yearStart')::integer>(p_query->>'yearEnd')::integer then raise exception 'Choose a valid category and year partition.' using errcode='23514'; end if;
    insert into public.catalog_jobs(provider_id,kind,query,created_by) values(p_provider,p_kind,p_query,auth.uid()) returning id into result;
  else
    select * into item from public.catalog_jobs where id=p_id for update;
    if not found then raise exception 'Job not found.' using errcode='23514'; end if;
    if p_action='pause' and item.state in ('queued','running') then update public.catalog_jobs set state='paused',lease_token=null,lease_expires_at=null,updated_at=now() where id=p_id;
    elsif p_action in ('resume','retry') and item.state in ('paused','failed') then update public.catalog_jobs set state='queued',lease_token=null,lease_expires_at=null,available_at=now(),last_error=null,attempts=0,updated_at=now() where id=p_id;
    elsif p_action='cancel' and item.state not in ('completed','cancelled') then update public.catalog_jobs set state='cancelled',lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_id;
    else raise exception 'Job transition unavailable.' using errcode='23514'; end if;
    result:=p_id;
  end if;
  perform app_private.control_audit('catalog_job_'||p_action,'catalog_job',result,p_reason,to_jsonb(item),p_query);
  return result;
end; $$;
create function public.claim_catalog_job(p_provider uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.catalog_jobs;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('catalog_job:'||p_provider,0));
  if not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled and bulk_approved) then raise exception 'Provider bulk permission unavailable.' using errcode='42501'; end if;
  update public.catalog_jobs set state=case when attempts>=max_attempts then 'failed' else 'queued' end,lease_token=null,lease_expires_at=null,last_error='lease_expired',updated_at=now() where provider_id=p_provider and state='running' and lease_expires_at<=now();
  if exists(select 1 from public.catalog_jobs where provider_id=p_provider and state='running') then return null; end if;
  select * into item from public.catalog_jobs where provider_id=p_provider and state='queued' and available_at<=now() and attempts<max_attempts order by available_at,created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.catalog_jobs set state='running',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',attempts=attempts+1,started_at=coalesce(started_at,now()),updated_at=now() where id=item.id returning * into item;
  return to_jsonb(item);
end; $$;
create function public.finish_catalog_batch(p_id uuid,p_lease uuid,p_checkpoint jsonb,p_counts jsonb,p_done boolean default false,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare item public.catalog_jobs;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501'; end if;
  select * into item from public.catalog_jobs where id=p_id for update;
  if not found or item.state<>'running' or item.lease_token is distinct from p_lease or item.lease_expires_at<=now() then raise exception 'Lease no longer valid.' using errcode='40001'; end if;
  if octet_length(p_checkpoint::text)>4000 or exists(select 1 from jsonb_each_text(p_counts) where key not in ('processed','imported','updated','skipped','failed') or value !~ '^[0-9]{1,3}$' or value::integer>100) then raise exception 'Invalid bounded batch.' using errcode='23514'; end if;
  update public.catalog_jobs set checkpoint=case when p_error is null then p_checkpoint else checkpoint end,
    processed=processed+coalesce((p_counts->>'processed')::integer,0),imported=imported+coalesce((p_counts->>'imported')::integer,0),updated=updated+coalesce((p_counts->>'updated')::integer,0),skipped=skipped+coalesce((p_counts->>'skipped')::integer,0),failed=failed+coalesce((p_counts->>'failed')::integer,0),
    state=case when p_error is not null and attempts>=max_attempts then 'failed' when p_done then 'completed' else 'queued' end,
    available_at=now()+make_interval(secs=>case when p_error is not null then least(3600,30*power(2,least(attempts,6))::integer) else 2 end),last_error=p_error,
    attempts=case when p_error is null then 0 else attempts end,lease_token=null,lease_expires_at=null,finished_at=case when p_done then now() else finished_at end,updated_at=now() where id=p_id;
end; $$;
create function public.reserve_provider_budget(p_provider uuid,p_units integer default 3) returns void language plpgsql security definer set search_path='' as $$
declare used integer; ceiling integer;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501'; end if;
  if p_units not between 1 and 10 then raise exception 'Invalid request budget.' using errcode='23514'; end if;
  select least(90,greatest(1,coalesce((settings->>'requestsPerMinute')::integer,30))) into ceiling from public.platform_settings where singleton;
  insert into app_private.provider_budgets(provider_id,window_start,units) values(p_provider,date_trunc('minute',now()),p_units)
  on conflict(provider_id,window_start) do update set units=app_private.provider_budgets.units+p_units returning units into used;
  if used>ceiling then raise exception 'Provider budget exhausted for this minute.' using errcode='P0001'; end if;
  delete from app_private.provider_budgets where window_start<now()-interval '1 day';
end; $$;
create function public.control_save_schedule(p_id uuid,p_provider uuid,p_name text,p_kind text,p_query jsonb,p_interval integer,p_enabled boolean,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Schedule unavailable.' using errcode='42501'; end if;
  if p_enabled and not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled and bulk_approved) then raise exception 'Provider bulk permission unavailable.' using errcode='42501'; end if;
  if p_id is null then insert into public.catalog_schedules(provider_id,name,kind,query,interval_minutes,enabled,updated_by) values(p_provider,p_name,p_kind,p_query,p_interval,p_enabled,auth.uid()) returning id into result;
  else update public.catalog_schedules set name=p_name,kind=p_kind,query=p_query,interval_minutes=p_interval,enabled=p_enabled,updated_by=auth.uid(),updated_at=now() where id=p_id and provider_id=p_provider returning id into result; end if;
  if result is null then raise exception 'Schedule not found.' using errcode='23514'; end if;
  perform app_private.control_audit('catalog_schedule_saved','catalog_schedule',result,p_reason);
  return result;
end; $$;
create function public.enqueue_due_catalog_jobs(p_providers uuid[] default '{}') returns integer language plpgsql security definer set search_path='' as $$
declare schedule public.catalog_schedules; queued integer:=0; result uuid;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted scheduler required.' using errcode='42501'; end if;
  for schedule in select s.* from public.catalog_schedules s join public.metadata_providers p on p.id=s.provider_id where s.provider_id=any(p_providers) and s.enabled and s.next_run_at<=now() and p.approved and p.enabled and p.bulk_approved order by s.next_run_at for update of s skip locked limit 6 loop
    if not exists(select 1 from public.catalog_jobs where id=schedule.last_job_id and state in ('queued','running','paused')) then
      insert into public.catalog_jobs(provider_id,kind,query) values(schedule.provider_id,schedule.kind,schedule.query) returning id into result;
      update public.catalog_schedules set last_job_id=result,next_run_at=now()+make_interval(mins=>interval_minutes),updated_at=now() where id=schedule.id;
      queued:=queued+1;
    end if;
  end loop;
  return queued;
end; $$;
create function public.capture_platform_metrics() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted scheduler required.' using errcode='42501'; end if;
  insert into public.platform_daily_metrics(day,registered_users,catalog_titles,published_collections,collection_favorites,collection_saves,collection_imports)
  select current_date,(select count(*) from public.profiles where status<>'purging'),(select count(*) from public.titles where status<>'merged'),(select count(*) from public.collections where visibility='published' and removed_at is null),(select count(*) from public.collection_favorites),(select count(*) from public.collection_saves),(select count(*) from public.collection_imports)
  on conflict(day) do update set registered_users=excluded.registered_users,catalog_titles=excluded.catalog_titles,published_collections=excluded.published_collections,collection_favorites=excluded.collection_favorites,collection_saves=excluded.collection_saves,collection_imports=excluded.collection_imports,captured_at=now();
end; $$;

do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['control_save_settings','maintenance_guard','control_save_document','control_rollback_document','dismiss_control_document','control_catalog_job','claim_catalog_job','finish_catalog_batch','reserve_provider_budget','control_save_schedule','enqueue_due_catalog_jobs','capture_platform_metrics']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
end loop; end; $$;
grant execute on function public.control_save_settings(jsonb,text),public.control_save_document(uuid,text,jsonb,integer,text),public.control_rollback_document(uuid,text),public.dismiss_control_document(uuid),public.control_catalog_job(uuid,text,uuid,text,jsonb,text),public.control_save_schedule(uuid,uuid,text,text,jsonb,integer,boolean,text) to authenticated;
grant execute on function public.claim_catalog_job(uuid),public.finish_catalog_batch(uuid,uuid,jsonb,jsonb,boolean,text),public.reserve_provider_budget(uuid,integer),public.enqueue_due_catalog_jobs(uuid[]),public.capture_platform_metrics() to service_role;
commit;
