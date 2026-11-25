begin;
create table public.catalog_job_progress (
  job_id uuid references public.catalog_jobs(id) on delete cascade,source text not null,external_id text not null,
  outcome text not null check(outcome in ('imported','updated','skipped','failed')),title_id uuid references public.titles(id),
  created_at timestamptz not null default now(),primary key(job_id,source,external_id)
);
alter table public.catalog_job_progress enable row level security;
revoke all on public.catalog_job_progress from public,anon,authenticated;
grant select on public.catalog_job_progress to authenticated;
grant all on public.catalog_job_progress to service_role;
create policy catalog_progress_owner_read on public.catalog_job_progress for select to authenticated using(app_private.has_role('super_admin'));
create function public.ingest_catalog_job_title(p_job uuid,p_lease uuid,p_source text,p_payload jsonb,p_full boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.catalog_jobs; registration public.metadata_providers; progress public.catalog_job_progress; canonical uuid; prior uuid; outcome text;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted catalog worker required.' using errcode='42501'; end if;
  select * into job from public.catalog_jobs where id=p_job for update;
  if not found or job.state<>'running' or job.lease_token is distinct from p_lease or job.lease_expires_at<=now() then raise exception 'Job lease expired or revoked.' using errcode='40001'; end if;
  select * into registration from public.metadata_providers where id=job.provider_id and approved and enabled and bulk_approved for update;
  if not found or (registration.key='tmdb' and p_source not in ('tmdb.movie','tmdb.tv')) or (registration.key='myanimelist' and p_source<>'myanimelist.anime') or registration.key not in ('tmdb','myanimelist') then raise exception 'Provider bulk permission unavailable.' using errcode='42501'; end if;
  select * into progress from public.catalog_job_progress where job_id=p_job and source=p_source and external_id=p_payload->>'externalId';
  if found then return jsonb_build_object('id',progress.title_id,'outcome',progress.outcome,'replayed',true); end if;
  select title_id into prior from public.provider_title_ids where provider_id=job.provider_id and external_type=p_payload->>'media' and external_id=p_payload->>'externalId';
  if prior is not null and not p_full then canonical:=public.resolve_title(prior);outcome:='skipped';
  else
    canonical:=case when registration.key='tmdb' then public.ingest_tmdb_title(job.provider_id,p_payload) else public.ingest_mal_title(job.provider_id,p_payload) end;
    outcome:=case when prior is null then 'imported' else 'updated' end;
  end if;
  insert into public.catalog_job_progress(job_id,source,external_id,outcome,title_id) values(p_job,p_source,p_payload->>'externalId',outcome,canonical);
  update public.catalog_jobs set processed=processed+1,imported=imported+case when outcome='imported' then 1 else 0 end,updated=updated+case when outcome='updated' then 1 else 0 end,skipped=skipped+case when outcome='skipped' then 1 else 0 end,updated_at=now() where id=p_job;
  return jsonb_build_object('id',canonical,'outcome',outcome,'replayed',false);
end; $$;
create function public.record_catalog_job_failure(p_job uuid,p_lease uuid,p_source text,p_external text,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare job public.catalog_jobs;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501'; end if;
  select * into job from public.catalog_jobs where id=p_job for update;
  if not found or job.state<>'running' or job.lease_token is distinct from p_lease or job.lease_expires_at<=now() then raise exception 'Job lease expired or revoked.' using errcode='40001'; end if;
  insert into public.catalog_job_progress(job_id,source,external_id,outcome) values(p_job,p_source,p_external,'failed') on conflict do nothing;
  if found then update public.catalog_jobs set processed=processed+1,failed=failed+1,updated_at=now() where id=p_job; end if;
  insert into public.catalog_job_failures(job_id,source,external_id,code) values(p_job,p_source,p_external,p_code)
  on conflict(job_id,source,external_id) do update set code=excluded.code,attempts=public.catalog_job_failures.attempts+1;
end; $$;
-- Audit failed privileged requests outside their rolled-back mutation transaction.
create function public.record_control_failure(p_actor uuid,p_operation text,p_code text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted audit recorder required.' using errcode='42501'; end if;
  if p_operation !~ '^[a-z_]{1,50}$' or p_code !~ '^[A-Za-z0-9_]{1,50}$' then raise exception 'Invalid safe audit label.' using errcode='23514'; end if;
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,reason,outcome)
  select p_actor,(select role::text from public.admin_roles where user_id=p_actor and suspended_at is null order by role limit 1),'failed_'||p_operation,'security',p_code,'failure'
  where exists(select 1 from public.profiles where id=p_actor);
end; $$;
revoke all on function public.ingest_catalog_job_title(uuid,uuid,text,jsonb,boolean),public.record_catalog_job_failure(uuid,uuid,text,text,text),public.record_control_failure(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ingest_catalog_job_title(uuid,uuid,text,jsonb,boolean),public.record_catalog_job_failure(uuid,uuid,text,text,text),public.record_control_failure(uuid,text,text) to service_role;
commit;
