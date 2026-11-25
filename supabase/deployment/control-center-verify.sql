-- BEGIN GENERATED ASSERTIONS
-- Self-contained and read-only: no dependency on an upgrade session/snapshot.
do $scenestack_control_verify$
declare v_actual text;
begin
  perform set_config('search_path','public',true);
  if not array['202611230001','202611230002','202611230003','202611230004','202611230005','202611230006','202611230007','202611230008','202611230009','202611230010','202611230011','202611230012','202611230013','202611230014','202611230015','202611230016','202611230017','202611230018','202611230019','202611230020','202611230021','202611230022','202611230023','202611230024','202611250025','202611250026','202611250027','202611250028','202611250029','202611250030','202611250031']::text[] <@ (select coalesce(array_agg(version),'{}'::text[]) from supabase_migrations.schema_migrations) then raise exception 'Expected migrations 001–031 are not all recorded.'; end if;
  select fingerprint into v_actual from (select md5(jsonb_build_object('inventory',i.inventory,'structure',s.structure)::text) fingerprint
from (select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(q) order by q.schema,q.name) from(select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r')q),
 'columns',(select jsonb_agg(to_jsonb(q) order by q.schema,q.table_name,q.position) from(select n.nspname schema,c.relname table_name,a.attnum position,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull required,a.attgenerated generated,has_column_privilege('anon',c.oid,a.attnum,'SELECT') anon_read,has_column_privilege('authenticated',c.oid,a.attnum,'SELECT') member_read,has_column_privilege('authenticated',c.oid,a.attnum,'INSERT') member_insert,has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE') member_update,has_column_privilege('service_role',c.oid,a.attnum,'SELECT') worker_read from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' and a.attnum>0 and not a.attisdropped)q),
 'functions',(select jsonb_agg(to_jsonb(q) order by q.schema,q.name,q.args) from(select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,pg_get_function_result(p.oid) result,p.prosecdef definer,p.proconfig config,md5(p.prosrc) body_hash,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') member,has_function_privilege('service_role',p.oid,'EXECUTE') worker from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private'))q),
 'policies',(select jsonb_agg(to_jsonb(q) order by q.schemaname,q.tablename,q.policyname) from(select schemaname,tablename,policyname,roles,cmd,permissive,qual,with_check from pg_policies where schemaname in ('public','app_private') or(schemaname='storage' and policyname like 'scenestack_%'))q),
 'grants',(select jsonb_agg(to_jsonb(q) order by q.schema,q.name,q.grantee) from(select n.nspname schema,c.relname name,r.grantee,has_table_privilege(r.grantee,c.oid,'SELECT') can_select,has_table_privilege(r.grantee,c.oid,'INSERT') can_insert,has_table_privilege(r.grantee,c.oid,'UPDATE') can_update,has_table_privilege(r.grantee,c.oid,'DELETE') can_delete,has_table_privilege(r.grantee,c.oid,'TRUNCATE') can_truncate,has_table_privilege(r.grantee,c.oid,'REFERENCES') can_reference,has_table_privilege(r.grantee,c.oid,'TRIGGER') can_trigger from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join(values('anon'),('authenticated'),('service_role'))r(grantee) where n.nspname in ('public','app_private') and c.relkind='r')q)
) as inventory) i cross join (select jsonb_build_object(
  'constraints',(select coalesce(jsonb_agg(to_jsonb(r) order by schema,table_name,name),'[]') from (select n.nspname schema,c.relname table_name,k.conname name,pg_get_constraintdef(k.oid,true) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and k.contype<>'n')r),
  'indexes',(select coalesce(jsonb_agg(to_jsonb(r) order by schemaname,tablename,indexname),'[]') from (select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','app_private'))r),
  'triggers',(select coalesce(jsonb_agg(to_jsonb(r) order by schema,table_name,name),'[]') from (select n.nspname schema,c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid,true) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and not t.tgisinternal)r)
) structure) s) expected;
  if v_actual is distinct from 'e52b171481aa9f7547d0f5424436b339' then raise exception 'Installed schema/RLS/grants do not match migration 031. Stop and inspect drift.'; end if;
  if (select count(*) from app_private.platform_owner)<>1 or (select count(*) from public.admin_roles where role='super_admin')<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='973543d2-96d9-498b-b9b4-3adf237bd507'::uuid and p.status='active' and a.suspended_at is null) then raise exception 'Original active Super Admin invariant failed.'; end if;
  if (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Moderator capacity invariant failed.'; end if;
  raise notice 'Control Center schema, RLS, grants, original owner and team capacity verified.';
end;
$scenestack_control_verify$;
-- END GENERATED ASSERTIONS

-- Read-only verification after the atomic bundle OR the official CLI push.
-- Run as postgres in the SAME Supabase project's SQL Editor.

-- 1. Expect exactly seven rows, in this order.
select version,name from supabase_migrations.schema_migrations
where version between '202611250025' and '202611250031' order by version;

-- 2. Expect one row: the original owner, active, super_admin, not suspended.
select o.user_id,p.username,p.status,a.role,a.suspended_at,a.granted_at
from app_private.platform_owner o
join public.profiles p on p.id=o.user_id
join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin';

-- 3. Expect one Super Admin; at most five occupied/reserved moderator seats.
select
  (select count(*) from public.admin_roles where role='super_admin') super_admins,
  (select count(*) from public.admin_roles where role='moderator') moderator_positions,
  (select count(*) from public.admin_invitations where status='pending' and expires_at>now()) reserved_positions,
  (select count(*) from public.admin_roles where role='moderator')+
  (select count(*) from public.admin_invitations where status='pending' and expires_at>now())<=5 capacity_valid,
  not exists(select 1 from public.admin_roles where role not in ('super_admin','moderator')) assignable_roles_valid;

-- 4. Every required function must be present. SQL Editor has no signed-in
-- application JWT: control_identity() returning NULL here is not a role failure.
select name,to_regprocedure(name) is not null present from unnest(array[
  'public.control_identity()',
  'public.control_workspace(text,text,text,integer,date,date,text)',
  'public.invite_moderator(uuid,text)',
  'public.respond_moderator_invitation(uuid,boolean)',
  'public.manage_moderator(uuid,text,text)',
  'public.control_edit_title(uuid,jsonb,jsonb,text)',
  'public.submit_control_case(text,text,text,uuid,uuid,uuid,jsonb)',
  'public.claim_catalog_job(uuid)',
  'public.ingest_catalog_job_title(uuid,uuid,text,jsonb,boolean)'
]) name;

-- 5. All 24 new tables must exist and have RLS enabled.
select expected.schema_name,expected.table_name,c.oid is not null present,coalesce(c.relrowsecurity,false) rls_enabled
from (values
  ('public','admin_invitations'),('public','control_enforcements'),
  ('public','control_cases'),('public','control_messages'),
  ('public','title_request_votes'),('public','control_notifications'),
  ('public','support_templates'),('public','platform_settings'),
  ('public','control_documents'),('public','control_document_revisions'),
  ('public','document_dismissals'),('public','metadata_locks'),
  ('public','metadata_revisions'),('public','correction_field_decisions'),
  ('public','catalog_jobs'),('public','catalog_job_failures'),
  ('public','catalog_schedules'),('public','platform_daily_metrics'),
  ('public','search_daily_metrics'),('public','admin_user_notes'),
  ('public','control_document_deliveries'),('public','catalog_job_progress'),
  ('app_private','activity_days'),('app_private','provider_budgets')
) expected(schema_name,table_name)
left join pg_namespace n on n.nspname=expected.schema_name
left join pg_class c on c.relnamespace=n.oid and c.relname=expected.table_name
order by 1,2;

-- 6. Expect true for member RPC execution; false for anonymous execution and
-- direct client role modification. Role checks also execute inside each RPC.
select
  has_function_privilege('authenticated','public.control_identity()','execute') member_identity_rpc,
  has_function_privilege('authenticated','public.control_workspace(text,text,text,integer,date,date,text)','execute') member_workspace_rpc,
  has_function_privilege('anon','public.control_identity()','execute') anonymous_identity_rpc,
  has_table_privilege('authenticated','public.admin_roles','insert') client_role_insert,
  has_table_privilege('authenticated','public.admin_roles','update') client_role_update,
  has_table_privilege('authenticated','public.admin_roles','delete') client_role_delete;

-- 7. Inspect the unique owner index, role check, and serialized team triggers.
select indexname,indexdef from pg_indexes where schemaname='public' and indexname='sole_super_admin';
select conname,pg_get_constraintdef(oid) definition from pg_constraint
where conrelid='public.admin_roles'::regclass and conname='control_roles_only';
select tgname,pg_get_triggerdef(oid) definition from pg_trigger
where tgname in ('control_team_guard','control_invitation_guard') and not tgisinternal;

-- 8. Confirm existing application records remain. Counts may increase through
-- legitimate app use. The atomic SQL bundle checks exact row fingerprints
-- before/after while holding write-blocking table locks during the upgrade.
select 'profiles' resource,count(*) records from public.profiles
union all select 'canonical_titles',count(*) from public.titles where status<>'merged'
union all select 'collections',count(*) from public.collections
union all select 'tracking',count(*) from public.tracking
union all select 'ratings',count(*) from public.ratings
union all select 'favorites',count(*) from public.favorites
union all select 'collection_items',count(*) from public.collection_items;

-- 9. Permission decisions remain unchanged. This query does not enable APIs.
select key,approved,enabled,bulk_approved from public.metadata_providers order by key;

-- Finally, in the application sign in with the EXISTING owner's Google account,
-- then open /api/control/identity and /admin. The real authenticated endpoint
-- should return role "super_admin". Do not fabricate JWT claims in SQL Editor,
-- rerun bootstrap_platform_owner, or grant yourself a new role.
