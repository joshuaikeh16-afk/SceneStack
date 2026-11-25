-- Operator confirmed public-release and bulk-use permission for TMDB and MAL.
-- Configuration/data only; no schema, RLS, user permissions or existing titles change.
-- Run the WHOLE file as postgres. Reruns do not create duplicate launch jobs.
do $catalog_launch$
declare provider public.metadata_providers; previous jsonb; category text; maximum integer;
begin
  perform pg_advisory_xact_lock(710027);
  if not exists(select 1 from supabase_migrations.schema_migrations where version='202611250031') or to_regprocedure('public.control_identity()') is null then raise exception 'Control Center 031 must be installed first.'; end if;
  if (select count(*) from app_private.platform_owner)<>1 or (select count(*) from public.admin_roles where role='super_admin')<>1 or not exists(select 1 from app_private.platform_owner o join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' join public.profiles p on p.id=o.user_id where o.user_id='973543d2-96d9-498b-b9b4-3adf237bd507' and a.suspended_at is null and p.status='active') then raise exception 'Original owner invariant failed.'; end if;
  if (select count(*) from public.metadata_providers where key in ('tmdb','myanimelist'))<>2 then raise exception 'Expected both existing provider registrations.'; end if;
  for provider in select * from public.metadata_providers where key in ('tmdb','myanimelist') order by key for update loop
    previous:=to_jsonb(provider);
    if not (provider.approved and provider.enabled and provider.bulk_approved) then
      update public.metadata_providers set approved=true,enabled=true,bulk_approved=true where id=provider.id;
      insert into public.audit_logs(action,entity_type,entity_id,reason,previous_state,next_state)
      values('provider_permission_confirmed','metadata_provider',provider.id,'Operator confirmed public-release and bulk-use permission in the SceneStack launch session. This records operator confirmation, not provider endorsement.',previous,jsonb_build_object('approved',true,'enabled',true,'bulk_approved',true));
    end if;
    foreach category in array case when provider.key='myanimelist' then array['anime'] else array['movie','series','cartoon','drama','documentary'] end loop
      maximum:=case category when 'movie' then 50000 when 'series' then 30000 when 'anime' then 10000 else 5000 end;
      if not exists(select 1 from public.catalog_jobs where provider_id=provider.id and query->>'batchTag'='launch-catalog-20261125' and query->>'category'=category) then
        insert into public.catalog_jobs(provider_id,kind,query)
        values(provider.id,'historical',jsonb_build_object('category',category,'yearStart',2000,'yearEnd',2026,'maxRecords',maximum,'batchTag','launch-catalog-20261125'));
        insert into public.audit_logs(action,entity_type,entity_id,reason,next_state)
        values('catalog_launch_job_queued','metadata_provider',provider.id,'Operator requested 50,000+ canonical titles. Bounded resumable historical job; no provider catalogs are downloaded into the browser.',jsonb_build_object('category',category,'maxRecords',maximum));
      end if;
    end loop;
  end loop;
  raise notice 'Both provider bulk gates enabled; six bounded launch jobs exist. Configure server gates and run the worker to import metadata.';
end;
$catalog_launch$;
