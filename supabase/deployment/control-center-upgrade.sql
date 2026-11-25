-- SceneStack Control Center: corrected SQL Editor upgrade / verifier, 025–031.
-- Verified target: zyghuvjvelozjprdfula; original owner UUID is checked below.
-- Run this ENTIRE file as postgres. It is ONE SQL statement: all preservation
-- state lives in PL/pgSQL variables, never in temporary tables or later queries.
-- Complete installations are verified without replaying DDL. A tracked, matching
-- migration prefix resumes atomically. Untracked objects/schema drift fail closed.
do $scenestack_control_upgrade$
declare
  v_versions constant text[] := array['202611250025','202611250026','202611250027','202611250028','202611250029','202611250030','202611250031']::text[];
  v_baseline_versions constant text[] := array['202611230001','202611230002','202611230003','202611230004','202611230005','202611230006','202611230007','202611230008','202611230009','202611230010','202611230011','202611230012','202611230013','202611230014','202611230015','202611230016','202611230017','202611230018','202611230019','202611230020','202611230021','202611230022','202611230023','202611230024']::text[];
  v_expected constant jsonb := '{"202611230024":"adb1393ea5a581e00d183b0864f64dce","202611250025":"1d9c4e2036d0a1e7720d93c2b16646a2","202611250026":"377558aa34bdf8d11e7fc0034408c3ba","202611250027":"f95540947c614fdc05d261dcffef5036","202611250028":"c5e332e124b2bba77809ce983dc8c68e","202611250029":"c1ed2f3b2b22fd209bf36cf58bd04b2b","202611250030":"29897fe3a651906d75d5f1fe676b5c7f","202611250031":"e52b171481aa9f7547d0f5424436b339"}'::jsonb;
  v_schema_sql constant text := $schema_fingerprint$select md5(jsonb_build_object('inventory',i.inventory,'structure',s.structure)::text) fingerprint
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
) structure) s$schema_fingerprint$;
  v_snapshot_sql constant text := $data_fingerprint$select jsonb_object_agg(name,jsonb_build_object('count',count,'fingerprint',fingerprint)) from (
  select 'profiles' name,count(*) count,md5(coalesce(string_agg(md5((to_jsonb(t)-array['verified_at','verified_by','username_change_required'])::text),'' order by id),'')) fingerprint from public.profiles t
  union all select 'titles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.titles t
  union all select 'collections',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.collections t
  union all select 'tracking',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.tracking t
  union all select 'ratings',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.ratings t
  union all select 'favorites',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,title_id),'')) from public.favorites t
  union all select 'collection_items',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by collection_id,title_id),'')) from public.collection_items t
) preservation$data_fingerprint$;
  v_history text[];
  v_version text;
  v_latest text := '202611230024';
  v_seen_missing boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_actual text;
  v_applied integer := 0;
begin
  -- Catalog deparsing depends on search_path; compare under a fixed scope.
  perform set_config('search_path','public',true);
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);
  perform pg_advisory_xact_lock(710000);
  select coalesce(array_agg(version order by version),'{}'::text[]) into v_history from supabase_migrations.schema_migrations;
  if not v_baseline_versions <@ v_history or exists(select 1 from unnest(v_history) h where h <> all(v_baseline_versions || v_versions)) then
    raise exception 'Unexpected migration history. Stop and inspect the configured project; no upgrade was applied.';
  end if;
  foreach v_version in array v_versions loop
    if v_version = any(v_history) then
      if v_seen_missing then raise exception 'Non-contiguous Control Center migration history. Stop and inspect; no upgrade was applied.'; end if;
      v_latest := v_version;
    else v_seen_missing := true;
    end if;
  end loop;
  if (select count(*) from app_private.platform_owner)<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='973543d2-96d9-498b-b9b4-3adf237bd507'::uuid and p.status='active' and coalesce(to_jsonb(a)->>'suspended_at','')='') then
    raise exception 'The verified active owner does not match. No privileges or application data were changed.';
  end if;
  execute v_schema_sql into v_actual;
  if v_actual is distinct from v_expected->>v_latest then
    raise exception 'Schema does not match recorded migration %. Untracked/partial objects or schema drift detected; no migration was replayed.', v_latest;
  end if;
  if not v_seen_missing then
    if (select count(*) from public.admin_roles where role='super_admin')<>1 or (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Installed team capacity invariant failed.'; end if;
    raise notice 'Control Center 025–031 already installed: schema, RLS, grants, owner and team constraints verified. No migrations replayed.';
    return;
  end if;
  lock table supabase_migrations.schema_migrations,public.profiles,public.titles,public.collections,public.tracking,public.ratings,public.favorites,public.collection_items in share row exclusive mode;
  if v_history is distinct from (select coalesce(array_agg(version order by version),'{}'::text[]) from supabase_migrations.schema_migrations) then raise exception 'Migration history changed concurrently. Retry the entire statement.'; end if;
  execute v_snapshot_sql into v_before;

  -- 202611250025_control_center_team.sql; SHA256 96112eba7c41abe09fd5d114c3e46c5569c77a9ba73028f03505ab34491c2788
  if not '202611250025' = any(v_history) then
    execute $migration_202611250025$
-- Stop rather than silently reassigning an ambiguous existing owner. An empty
-- fresh installation may still use the trusted UUID bootstrap after migration.
do $$ begin
  if exists(select 1 from public.admin_roles a where a.role='super_admin' and not exists(select 1 from app_private.platform_owner o where o.user_id=a.user_id)) then
    raise exception 'An existing Super Admin is not the immutable platform owner. Review ownership before migrating; no privileges were changed.';
  end if;
  if exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id where p.status<>'active') then
    raise exception 'The existing owner account is not active. Restore verified owner access before migrating.';
  end if;
end; $$;

-- Retain the legacy enum label for stored function compatibility. Only these
-- two roles may be assigned after this migration. Archive retired assignments.
alter table public.admin_roles add column suspended_at timestamptz;
alter table public.admin_roles add column suspension_reason text check(char_length(suspension_reason)<=3000);
alter table public.audit_logs add column actor_role text;
alter table public.audit_logs add column reason text not null default '' check(char_length(reason)<=3000);
alter table public.audit_logs add column previous_state jsonb;
alter table public.audit_logs add column next_state jsonb;
alter table public.audit_logs add column outcome text not null default 'success' check(outcome in ('success','failure'));
insert into public.audit_logs(action,entity_type,entity_id,detail,previous_state)
select 'legacy_role_retired','profile',a.user_id,'Retired catalog editor or non-owner super admin assignment',to_jsonb(a)
from public.admin_roles a where a.role='catalog_editor' or (a.role='super_admin' and not exists(select 1 from app_private.platform_owner o where o.user_id=a.user_id));
delete from public.admin_roles a where a.role='catalog_editor' or (a.role='super_admin' and not exists(select 1 from app_private.platform_owner o where o.user_id=a.user_id)) or (a.role='moderator' and exists(select 1 from app_private.platform_owner o where o.user_id=a.user_id));
insert into public.admin_roles(user_id,role,granted_by) select user_id,'super_admin',user_id from app_private.platform_owner on conflict do nothing;
alter table public.admin_roles add constraint control_roles_only check(role in ('super_admin','moderator'));
create unique index sole_super_admin on public.admin_roles(role) where role='super_admin';
do $$ begin
  if (select count(*) from public.admin_roles where role='moderator')>5 then
    raise exception 'More than five legacy moderators exist. Review appointments before applying this migration.';
  end if;
end; $$;

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(), invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id), status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','expired')),
  reason text not null check(char_length(btrim(reason)) between 1 and 3000), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days', responded_at timestamptz,
  check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
create unique index one_pending_admin_invitation on public.admin_invitations(invited_user_id) where status='pending';
create index admin_invitations_expiry on public.admin_invitations(expires_at) where status='pending';
alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from public,anon,authenticated;
grant select on public.admin_invitations to authenticated;
grant all on public.admin_invitations to service_role;

create or replace function app_private.has_role(p_role public.admin_role) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.admin_roles where user_id=auth.uid() and suspended_at is null
    and (role='super_admin' or (p_role='moderator' and role='moderator')));
$$;
create policy admin_invitation_read on public.admin_invitations for select to authenticated using(invited_user_id=auth.uid() or app_private.has_role('super_admin'));
drop policy roles_self_read on public.admin_roles;
create policy roles_self_read on public.admin_roles for select to authenticated using((user_id=auth.uid() and suspended_at is null) or app_private.has_role('super_admin'));
drop policy audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using(app_private.has_role('super_admin') or (app_private.has_role('moderator') and actor_id=auth.uid()));

create function app_private.control_audit(p_action text,p_type text,p_id uuid,p_reason text,p_before jsonb default null,p_after jsonb default null) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,previous_state,next_state)
  values(auth.uid(),(select role::text from public.admin_roles where user_id=auth.uid() and suspended_at is null order by role limit 1),p_action,p_type,p_id,p_reason,p_before,p_after);
end; $$;

create function app_private.guard_control_team() returns trigger language plpgsql security definer set search_path='' as $$
declare occupied integer; candidate uuid;
begin
  -- Every appointment, invitation, acceptance and removal shares one lock.
  perform pg_advisory_xact_lock(710025);
  if tg_table_name='admin_roles' then
    if tg_op<>'INSERT' and old.role='super_admin' and exists(select 1 from app_private.platform_owner where user_id=old.user_id) then
      if tg_op='DELETE' then raise exception 'The platform owner cannot be removed.' using errcode='42501'; end if;
      if new.user_id<>old.user_id or new.role<>old.role or new.suspended_at is not null then raise exception 'The platform owner cannot be demoted or suspended.' using errcode='42501'; end if;
    end if;
    if tg_op='DELETE' then return old; end if;
    if new.role='super_admin' and not exists(select 1 from app_private.platform_owner where user_id=new.user_id) then raise exception 'Only the platform owner can be Super Admin.' using errcode='42501'; end if;
    if new.role='moderator' then
      if exists(select 1 from app_private.platform_owner where user_id=new.user_id) then raise exception 'Owner already holds Super Admin.' using errcode='23514'; end if;
      select count(*) into occupied from public.admin_roles where role='moderator' and user_id<>new.user_id;
      select occupied+count(*) into occupied from public.admin_invitations where status='pending' and expires_at>now() and invited_user_id<>new.user_id;
      if occupied>=5 then raise exception 'All five moderator positions are reserved.' using errcode='23514'; end if;
    end if;
  else
    if new.status='pending' and new.expires_at>now() then
      candidate:=new.invited_user_id;
      if exists(select 1 from public.admin_roles where user_id=candidate) then raise exception 'This member already holds an administrative position.' using errcode='23514'; end if;
      select count(*) into occupied from public.admin_roles where role='moderator';
      select occupied+count(*) into occupied from public.admin_invitations where status='pending' and expires_at>now() and id<>new.id;
      if occupied>=5 then raise exception 'All five moderator positions are reserved.' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end; $$;
create trigger control_team_guard before insert or update or delete on public.admin_roles for each row execute function app_private.guard_control_team();
create trigger control_invitation_guard before insert or update on public.admin_invitations for each row execute function app_private.guard_control_team();

create function public.control_identity() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('userId',user_id,'role',role,'appointedAt',granted_at) from public.admin_roles
  where user_id=auth.uid() and suspended_at is null and app_private.member() and role in ('super_admin','moderator') order by role limit 1;
$$;
create function public.invite_moderator(p_user uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('super_admin') or not app_private.active(p_user) then raise exception 'Appointment unavailable.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(710025);
  update public.admin_invitations set status='expired',responded_at=now() where status='pending' and expires_at<=now();
  insert into public.admin_invitations(invited_user_id,invited_by,reason) values(p_user,auth.uid(),p_reason) returning id into result;
  perform app_private.control_audit('moderator_invited','admin_invitation',result,p_reason);
  return result;
end; $$;
create function public.respond_moderator_invitation(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.admin_invitations;
begin
  if not app_private.member() then raise exception 'Invitation unavailable.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(710025);
  select * into invitation from public.admin_invitations where id=p_id and invited_user_id=auth.uid() for update;
  if not found or invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'Invitation has expired or is no longer pending.' using errcode='23514'; end if;
  update public.admin_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where id=p_id;
  if p_accept then insert into public.admin_roles(user_id,role,granted_by) values(auth.uid(),'moderator',invitation.invited_by); end if;
  perform app_private.control_audit(case when p_accept then 'moderator_appointed' else 'invitation_declined' end,'admin_invitation',p_id,'Recipient decision');
end; $$;
create function public.manage_moderator(p_user uuid,p_action text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 or exists(select 1 from app_private.platform_owner where user_id=p_user) then raise exception 'Team change unavailable.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(710025);
  select to_jsonb(r) into previous from public.admin_roles r where user_id=p_user and role='moderator' for update;
  if p_action='cancel_invitation' then
    update public.admin_invitations set status='cancelled',responded_at=now() where invited_user_id=p_user and status='pending';
    if not found then raise exception 'Pending invitation not found.' using errcode='23514'; end if;
  elsif previous is null then raise exception 'Moderator not found.' using errcode='23514';
  elsif p_action='remove' then delete from public.admin_roles where user_id=p_user and role='moderator';
  elsif p_action='suspend' then update public.admin_roles set suspended_at=now(),suspension_reason=p_reason where user_id=p_user and role='moderator';
  elsif p_action='restore' then update public.admin_roles set suspended_at=null,suspension_reason=null where user_id=p_user and role='moderator';
  else raise exception 'Invalid team action.' using errcode='23514'; end if;
  perform app_private.control_audit('moderator_'||p_action,'profile',p_user,p_reason,previous);
end; $$;

-- The legacy service-only grant endpoint cannot bypass invitations or mint an
-- additional owner. Keep revocation compatibility for trusted maintenance.
create or replace function public.manage_admin_role(p_actor uuid,p_user uuid,p_role public.admin_role,p_grant boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.active(p_actor) or not exists(select 1 from app_private.platform_owner where user_id=p_actor) or p_role<>'moderator' or p_grant then
    raise exception 'Use the moderator invitation workflow.' using errcode='42501';
  end if;
  delete from public.admin_roles where user_id=p_user and role='moderator';
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason) values(p_actor,'super_admin','moderator_removed','profile',p_user,'Trusted maintenance revocation');
end; $$;
create or replace function public.transfer_platform_owner(p_actor uuid,p_next uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(710025);
  perform 1 from app_private.platform_owner where user_id=p_actor for update;
  if not found or not app_private.active(p_actor) or not app_private.active(p_next) or p_next=p_actor then raise exception 'Ownership transfer unavailable.' using errcode='42501'; end if;
  update app_private.platform_owner set user_id=p_next;
  delete from public.admin_roles where user_id in (p_actor,p_next);
  insert into public.admin_roles(user_id,role,granted_by) values(p_next,'super_admin',p_actor);
  update public.admin_invitations set status='cancelled',responded_at=now() where invited_user_id=p_next and status='pending';
  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason) values(p_actor,'super_admin','ownership_transferred','profile',p_next,'Explicit trusted ownership transfer');
end; $$;

revoke all on function public.control_identity(),public.invite_moderator(uuid,text),public.respond_moderator_invitation(uuid,boolean),public.manage_moderator(uuid,text,text) from public,anon;
grant execute on function public.control_identity(),public.invite_moderator(uuid,text),public.respond_moderator_invitation(uuid,boolean),public.manage_moderator(uuid,text,text) to authenticated;
revoke all on function app_private.control_audit(text,text,uuid,text,jsonb,jsonb),app_private.guard_control_team() from public,anon,authenticated;

$migration_202611250025$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250025' then raise exception 'Migration 202611250025 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250025','control_center_team',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250026_control_cases_enforcement.sql; SHA256 08da22cc2799fd928f65be5025c5636601caa291b5f8197809f96a12214fe9c0
  if not '202611250026' = any(v_history) then
    execute $migration_202611250026$
create table public.control_enforcements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null, kind text not null check(kind in ('warning','suspension','ban','restriction')),
  feature text check(feature in ('publish','follow','collection_interaction','title_request','correction','report')),
  reason text not null check(char_length(btrim(reason)) between 1 and 3000), explanation text not null check(char_length(btrim(explanation)) between 1 and 3000),
  starts_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz, revoked_by uuid references public.profiles(id),
  case_id uuid, created_at timestamptz not null default now(),
  check((kind='restriction')=(feature is not null)),check(expires_at is null or expires_at>starts_at),check(kind<>'suspension' or expires_at is not null)
);
create index control_enforcements_effective on public.control_enforcements(user_id,kind,expires_at) where revoked_at is null;
alter table public.control_enforcements enable row level security;
revoke all on public.control_enforcements from public,anon,authenticated;
grant select(id,user_id,actor_id,kind,feature,explanation,starts_at,expires_at,revoked_at,case_id,created_at) on public.control_enforcements to authenticated;
grant all on public.control_enforcements to service_role;
create policy enforcement_read on public.control_enforcements for select to authenticated using(user_id=auth.uid() or app_private.has_role('moderator'));

create or replace function app_private.active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles p where p.id=p_id
    and (p.status='active' or (
      p.status='suspended'
      and exists(select 1 from public.moderation_actions a where a.target_user_id=p.id and a.action='suspension' and a.expires_at<=now())
      and not exists(select 1 from public.moderation_actions a where a.target_user_id=p.id and (a.action='ban' or (a.action='suspension' and (a.expires_at is null or a.expires_at>now()))))
    ))
    and not exists(select 1 from public.control_enforcements e where e.user_id=p_id and e.kind in ('suspension','ban') and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()))
  );
$$;
create function app_private.can_use(p_feature text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and not exists(select 1 from public.control_enforcements e where e.user_id=auth.uid() and e.kind='restriction' and e.feature=p_feature and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()));
$$;

create table public.control_cases (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('report','title_request','correction','appeal','support','flag')),
  owner_id uuid references public.profiles(id) on delete cascade, subject text not null check(char_length(btrim(subject)) between 1 and 300),
  description text not null default '' check(char_length(description)<=10000),
  status text not null default 'submitted' check(status in ('submitted','under_review','awaiting_information','resolved','dismissed','withdrawn','reopened','approved_pending_publication','fulfilled','rejected','merged','accepted','partially_accepted','open','assigned','in_progress','awaiting_user','closed')),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')), assigned_to uuid references public.profiles(id) on delete set null,
  report_id uuid unique references public.reports(id) on delete cascade, request_id uuid unique references public.missing_title_requests(id) on delete cascade,
  correction_id uuid unique references public.metadata_corrections(id) on delete cascade, enforcement_id uuid references public.control_enforcements(id),
  target_user_id uuid references public.profiles(id) on delete set null, collection_id uuid references public.collections(id) on delete set null,
  title_id uuid references public.titles(id), grouped_into uuid references public.control_cases(id),
  payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=40000),
  resolution text not null default '' check(char_length(resolution)<=3000), due_at timestamptz,
  satisfaction integer check(satisfaction between 1 and 5), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(grouped_into is null or grouped_into<>id),check(kind='support' or satisfaction is null),check(kind<>'appeal' or enforcement_id is not null)
);
alter table public.control_enforcements add constraint enforcement_case foreign key(case_id) references public.control_cases(id);
create unique index one_active_appeal on public.control_cases(enforcement_id) where kind='appeal' and status in ('submitted','under_review','awaiting_information','reopened');
create index control_cases_inbox on public.control_cases(kind,status,priority,created_at,id);
create index control_cases_owner on public.control_cases(owner_id,created_at desc,id);
create index control_cases_assignment on public.control_cases(assigned_to,status,created_at);
create table public.control_messages (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.control_cases(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null, body text not null check(char_length(btrim(body)) between 1 and 10000),
  internal boolean not null default false, created_at timestamptz not null default now()
);
create index control_messages_case on public.control_messages(case_id,created_at,id);
create table public.title_request_votes (
  case_id uuid references public.control_cases(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(case_id,user_id)
);
create table public.control_notifications (
  id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check(char_length(subject)<=300),body text not null default '' check(char_length(body)<=3000),
  href text not null check(href ~ '^/(activity|admin|announcements)(/|$|[?])'),
  event_key text not null,essential boolean not null default true,created_at timestamptz not null default now(),read_at timestamptz,
  unique(recipient_id,event_key)
);
create index control_notifications_unread on public.control_notifications(recipient_id,created_at desc) where read_at is null;
create table public.support_templates (
  id uuid primary key default gen_random_uuid(),title text not null check(char_length(title) between 1 and 160),
  body text not null check(char_length(body) between 1 and 10000),created_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
do $$ declare item text; begin
  foreach item in array array['control_cases','control_messages','title_request_votes','control_notifications','support_templates'] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('revoke all on public.%I from public,anon,authenticated',item);
    execute format('grant select on public.%I to authenticated',item);
    execute format('grant all on public.%I to service_role',item);
  end loop;
end; $$;
create function app_private.case_staff(p_kind text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.has_role('super_admin') or (p_kind in ('report','appeal','support','flag') and app_private.has_role('moderator'));
$$;
create function app_private.read_case(p_id uuid,p_internal boolean default false) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.control_cases c where c.id=p_id and (app_private.case_staff(c.kind) or (not p_internal and c.owner_id=auth.uid())));
$$;
create policy control_cases_read on public.control_cases for select to authenticated using(owner_id=auth.uid() or app_private.case_staff(kind));
create policy control_messages_read on public.control_messages for select to authenticated using(app_private.read_case(case_id,internal));
create policy request_votes_read on public.title_request_votes for select to authenticated using(user_id=auth.uid() or app_private.has_role('super_admin'));
create policy control_notifications_read on public.control_notifications for select to authenticated using(recipient_id=auth.uid());
create policy support_templates_read on public.support_templates for select to authenticated using(app_private.has_role('moderator'));
create trigger control_cases_updated before update on public.control_cases for each row execute function app_private.touch_updated_at();

create function app_private.control_notify(p_user uuid,p_subject text,p_body text,p_href text,p_event text) returns void language sql security definer set search_path='' as $$
  insert into public.control_notifications(recipient_id,subject,body,href,event_key) select p_user,p_subject,p_body,p_href,p_event where p_user is not null on conflict(recipient_id,event_key) do nothing;
$$;
create function app_private.case_event() returns trigger language plpgsql security definer set search_path='' as $$
declare administrator record;
begin
  if tg_op='INSERT' then
    for administrator in select user_id from public.admin_roles where suspended_at is null and (role='super_admin' or new.kind in ('report','appeal','support','flag')) loop
      perform app_private.control_notify(administrator.user_id,'New '||replace(new.kind,'_',' '),new.subject,'/admin/action-center/'||new.id,'case_created:'||new.id);
    end loop;
  elsif new.status is distinct from old.status or new.resolution is distinct from old.resolution then
    perform app_private.control_notify(new.owner_id,'Your '||replace(new.kind,'_',' ')||' was updated',coalesce(nullif(new.resolution,''),replace(new.status,'_',' ')),'/activity/'||new.id,'case_update:'||new.id||':'||new.updated_at);
    if new.kind='title_request' and new.status='fulfilled' then
      for administrator in select user_id from public.title_request_votes where case_id=new.id loop
        perform app_private.control_notify(administrator.user_id,'A supported title is available',new.subject,'/activity/'||new.id,'request_fulfilled:'||new.id);
      end loop;
    end if;
  end if;
  return new;
end; $$;
create function app_private.legacy_case() returns trigger language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
  if tg_table_name='reports' then
    snapshot:=case when new.collection_id is not null then (select jsonb_build_object('title',title,'description',description,'owner_id',owner_id) from public.collections where id=new.collection_id and visibility='published') else (select jsonb_build_object('username',username,'display_name',display_name,'bio',bio) from public.profiles where id=new.target_user_id) end;
    insert into public.control_cases(kind,owner_id,subject,description,report_id,target_user_id,collection_id,payload,created_at)
    values('report',new.reporter_id,new.reason,new.details,new.id,new.target_user_id,new.collection_id,jsonb_build_object('publicSnapshot',snapshot),new.created_at);
  elsif tg_table_name='missing_title_requests' then
    insert into public.control_cases(kind,owner_id,subject,description,request_id,payload,created_at) values('title_request',new.user_id,new.title,new.details,new.id,jsonb_build_object('category',new.kind),new.created_at);
  else
    insert into public.control_cases(kind,owner_id,subject,description,correction_id,title_id,payload,created_at) values('correction',new.user_id,'Metadata correction',new.reason,new.id,new.title_id,jsonb_build_object('fields',jsonb_build_object(new.field_name,new.proposed_value)),new.created_at);
  end if;
  return new;
end; $$;
create trigger report_control_case after insert on public.reports for each row execute function app_private.legacy_case();
create trigger request_control_case after insert on public.missing_title_requests for each row execute function app_private.legacy_case();
create trigger correction_control_case after insert on public.metadata_corrections for each row execute function app_private.legacy_case();
-- Preserve existing submissions, review outcomes and their linked canonical IDs.
insert into public.control_cases(kind,owner_id,subject,description,report_id,target_user_id,collection_id,status,resolution,created_at)
select 'report',reporter_id,reason,details,id,target_user_id,collection_id,case status when 'pending' then 'submitted' when 'approved' then 'resolved' else 'dismissed' end,'',created_at from public.reports;
insert into public.control_cases(kind,owner_id,subject,description,request_id,payload,status,title_id,created_at)
select 'title_request',user_id,title,details,id,jsonb_build_object('category',kind),case when resolved_title_id is not null and status='approved' then 'fulfilled' when status='pending' then 'submitted' when status='approved' then 'approved_pending_publication' else 'rejected' end,resolved_title_id,created_at from public.missing_title_requests;
insert into public.control_cases(kind,owner_id,subject,description,correction_id,title_id,payload,status,created_at)
select 'correction',user_id,'Metadata correction',reason,id,title_id,jsonb_build_object('fields',jsonb_build_object(field_name,proposed_value)),case status when 'pending' then 'submitted' when 'approved' then 'accepted' else 'rejected' end,created_at from public.metadata_corrections;
create trigger control_case_events after insert or update on public.control_cases for each row execute function app_private.case_event();

create function public.submit_control_case(p_kind text,p_subject text,p_body text,p_target uuid default null,p_collection uuid default null,p_title uuid default null,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); result uuid; raw_id uuid; counter integer;
begin
  if who is null or not exists(select 1 from public.profiles where id=who and status not in ('purging','deletion_pending')) then raise exception 'Account required.' using errcode='42501'; end if;
  if p_kind not in ('support','appeal','report','title_request','correction') then raise exception 'Invalid submission.' using errcode='23514'; end if;
  if p_kind not in ('support','appeal') and not app_private.can_use(p_kind) then raise exception 'This submission is currently restricted.' using errcode='42501'; end if;
  if p_kind in ('support','appeal') then
    -- Essential support/appeals remain available during a suspension or ban.
    insert into app_private.rate_limits(user_id,bucket,window_start,count) values(who,'essential_case',date_trunc('day',now()),1)
    on conflict(user_id,bucket,window_start) do update set count=app_private.rate_limits.count+1 returning count into counter;
    if counter>10 then raise exception 'Please try again tomorrow.' using errcode='P0001'; end if;
  else perform app_private.rate_limit('control_case',20,interval '1 day'); end if;
  if p_payload ? 'referenceUrl' and coalesce(p_payload->>'referenceUrl','')<>'' and (p_payload->>'referenceUrl' !~ '^https://[^/@[:space:]]+([/?#]|$)' or char_length(p_payload->>'referenceUrl')>2000) then raise exception 'Use a valid HTTPS reference.' using errcode='23514'; end if;
  if p_kind='report' then
    raw_id:=public.submit_report(p_target,p_collection,coalesce(p_payload->>'reason','other'),p_body);
    select id into result from public.control_cases where report_id=raw_id;
  elsif p_kind='title_request' then
    perform pg_advisory_xact_lock(hashtextextended('title_request:'||lower(btrim(p_subject))||coalesce(p_payload->>'category','')||coalesce(p_payload->>'year',''),0));
    if exists(select 1 from public.control_cases where kind='title_request' and lower(btrim(subject))=lower(btrim(p_subject)) and payload->>'category'=p_payload->>'category' and coalesce(payload->>'year','')=coalesce(p_payload->>'year','') and status not in ('rejected','withdrawn','fulfilled','merged')) then raise exception 'A matching request already exists. Support the existing request.' using errcode='23505'; end if;
    raw_id:=public.submit_missing_title(p_subject,(p_payload->>'category')::public.entertainment_kind,p_body);
    select id into result from public.control_cases where request_id=raw_id;
    update public.control_cases set payload=payload||p_payload where id=result;
  else
    if p_kind='correction' and (p_title is null or not exists(select 1 from public.titles where id=p_title and status<>'merged') or jsonb_typeof(p_payload->'fields')<>'object' or p_payload->'fields'='{}') then raise exception 'A title and proposed fields are required.' using errcode='23514'; end if;
    if p_kind='appeal' and not exists(select 1 from public.control_enforcements where id=(p_payload->>'enforcementId')::uuid and user_id=who) then raise exception 'Enforcement not found.' using errcode='42501'; end if;
    insert into public.control_cases(kind,owner_id,subject,description,title_id,enforcement_id,payload,status)
    values(p_kind,who,p_subject,p_body,p_title,case when p_kind='appeal' then (p_payload->>'enforcementId')::uuid end,p_payload,case when p_kind='support' then 'open' else 'submitted' end) returning id into result;
  end if;
  return result;
end; $$;

create function public.reply_control_case(p_id uuid,p_body text,p_internal boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.control_cases; result uuid; staff boolean;
begin
  select * into item from public.control_cases where id=p_id for update;
  staff:=app_private.case_staff(item.kind);
  if not found or (not staff and (item.owner_id is distinct from auth.uid() or p_internal)) or auth.uid() is null then raise exception 'Conversation unavailable.' using errcode='42501'; end if;
  if item.status in ('withdrawn','closed','merged') then raise exception 'Reopen this case before replying.' using errcode='23514'; end if;
  if not staff and item.kind not in ('appeal','support') then perform app_private.rate_limit('case_reply',60,interval '1 hour'); end if;
  insert into public.control_messages(case_id,author_id,body,internal) values(p_id,auth.uid(),p_body,p_internal) returning id into result;
  if not p_internal then
    if staff then perform app_private.control_notify(item.owner_id,'New reply',item.subject,'/activity/'||p_id,'case_reply:'||result);
    else perform app_private.control_notify(item.assigned_to,'Member replied',item.subject,'/admin/action-center/'||p_id,'case_reply:'||result); end if;
    if not staff and item.status in ('awaiting_information','awaiting_user') then update public.control_cases set status=case when item.kind='support' then 'in_progress' else 'under_review' end where id=p_id; end if;
  end if;
  if staff then perform app_private.control_audit(case when p_internal then 'case_internal_note' else 'case_reply' end,'case',p_id,'Written response'); end if;
  return result;
end; $$;
create function public.review_control_case(p_id uuid,p_status text,p_resolution text,p_priority text default 'normal',p_assignee uuid default null,p_group uuid default null,p_title uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare item public.control_cases; allowed text[];
begin
  select * into item from public.control_cases where id=p_id for update;
  if not found or not app_private.case_staff(item.kind) then raise exception 'Review unavailable.' using errcode='42501'; end if;
  if p_assignee is not null and not exists(select 1 from public.admin_roles where user_id=p_assignee and suspended_at is null and (role='super_admin' or item.kind in ('report','appeal','support','flag'))) then raise exception 'Assignee has no permission for this case.' using errcode='23514'; end if;
  allowed:=case item.kind
    when 'report' then array['submitted','under_review','awaiting_information','resolved','dismissed','reopened']
    when 'title_request' then array['submitted','under_review','awaiting_information','approved_pending_publication','fulfilled','rejected','merged']
    when 'correction' then array['submitted','under_review','awaiting_information','accepted','partially_accepted','rejected','merged']
    when 'appeal' then array['submitted','under_review','awaiting_information','accepted','partially_accepted','rejected']
    when 'support' then array['open','assigned','in_progress','awaiting_user','resolved','closed','reopened']
    else array['submitted','under_review','resolved','dismissed'] end;
  if p_status<>all(allowed) then raise exception 'Invalid status for this case type.' using errcode='23514'; end if;
  if p_status in ('resolved','dismissed','fulfilled','rejected','accepted','partially_accepted','merged','closed') and char_length(btrim(p_resolution)) not between 1 and 3000 then raise exception 'A public resolution is required.' using errcode='23514'; end if;
  if item.kind='title_request' and p_status='fulfilled' and (p_title is null or not exists(select 1 from public.titles where id=p_title and status not in ('merged','unavailable'))) then raise exception 'Publish or link a real title before fulfillment.' using errcode='23514'; end if;
  if p_group is not null and not exists(select 1 from public.control_cases where id=p_group and kind=item.kind and grouped_into is null and id<>p_id) then raise exception 'Invalid duplicate group.' using errcode='23514'; end if;
  if item.kind='correction' and p_status in ('accepted','partially_accepted') then raise exception 'Use individual metadata field decisions before resolving a correction.' using errcode='23514'; end if;
  if item.kind='appeal' and p_status='accepted' and exists(select 1 from public.control_enforcements where id=item.enforcement_id and revoked_at is null and (expires_at is null or expires_at>now())) then raise exception 'Revoke the associated restriction before accepting this appeal.' using errcode='23514'; end if;
  if item.kind='appeal' and p_status='partially_accepted' and not exists(select 1 from public.control_enforcements where id=item.enforcement_id and expires_at is not null and (item.payload->>'originalExpiresAt' is null or expires_at<(item.payload->>'originalExpiresAt')::timestamptz)) then raise exception 'Shorten the associated restriction before partial acceptance.' using errcode='23514'; end if;
  update public.control_cases set status=p_status,resolution=p_resolution,priority=p_priority,assigned_to=p_assignee,grouped_into=p_group,title_id=coalesce(p_title,title_id) where id=p_id;
  if item.request_id is not null then update public.missing_title_requests set status=case when p_status='fulfilled' then 'approved'::public.review_status when p_status='rejected' then 'rejected'::public.review_status else 'pending'::public.review_status end,resolved_title_id=case when p_status='fulfilled' then p_title else null end,reviewer_id=auth.uid(),reviewed_at=now() where id=item.request_id; end if;
  if item.report_id is not null then update public.reports set status=case when p_status='resolved' then 'approved'::public.review_status when p_status='dismissed' then 'rejected'::public.review_status else 'pending'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_resolution where id=item.report_id; end if;
  perform app_private.control_audit('case_reviewed','case',p_id,p_resolution,jsonb_build_object('status',item.status),jsonb_build_object('status',p_status,'assignee',p_assignee));
end; $$;
create function public.member_case_action(p_id uuid,p_action text,p_rating integer default null) returns void language plpgsql security definer set search_path='' as $$
declare item public.control_cases;
begin
  select * into item from public.control_cases where id=p_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Case unavailable.' using errcode='42501'; end if;
  if p_action='withdraw' and item.status in ('submitted','under_review','awaiting_information','reopened') then update public.control_cases set status='withdrawn' where id=p_id;
  elsif p_action='reopen' and item.kind='support' and item.status in ('closed','resolved') then update public.control_cases set status='reopened' where id=p_id;
  elsif p_action='rate' and item.kind='support' and item.status in ('closed','resolved') and p_rating between 1 and 5 then update public.control_cases set satisfaction=p_rating where id=p_id;
  else raise exception 'This action is not available.' using errcode='23514'; end if;
end; $$;
create function public.vote_title_request(p_id uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  if not app_private.can_use('title_request') or not exists(select 1 from public.control_cases where id=p_id and kind='title_request' and status not in ('rejected','withdrawn','merged')) then raise exception 'Request unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('request_vote',100,interval '1 hour');
  if p_enabled then insert into public.title_request_votes(case_id,user_id) values(p_id,who) on conflict do nothing; else delete from public.title_request_votes where case_id=p_id and user_id=who; end if;
end; $$;
create function public.browse_title_requests(p_query text default '',p_status text default null,p_limit integer default 24,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.require_member();
  if char_length(p_query)>120 or p_limit not between 1 and 50 or p_offset not between 0 and 10000 then raise exception 'Invalid request page.' using errcode='23514'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select c.id,c.subject,c.description,c.status,c.payload->>'category' category,c.payload->>'year' as release_year,c.title_id,c.created_at,
    (select count(*) from public.title_request_votes where case_id=c.id) votes,exists(select 1 from public.title_request_votes where case_id=c.id and user_id=auth.uid()) supported
    from public.control_cases c where c.kind='title_request' and c.status<>'withdrawn' and (p_status is null or c.status=p_status) and c.subject ilike '%'||p_query||'%' order by c.created_at desc,c.id limit p_limit offset p_offset) r);
end; $$;

create function public.enforce_control_account(p_user uuid,p_kind text,p_reason text,p_explanation text,p_feature text default null,p_until timestamptz default null,p_case uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('moderator') or exists(select 1 from public.admin_roles where user_id=p_user) or exists(select 1 from app_private.platform_owner where user_id=p_user) then raise exception 'Enforcement unavailable for this account.' using errcode='42501'; end if;
  if p_case is not null and not exists(select 1 from public.control_cases where id=p_case and kind in ('report','appeal','flag') and (target_user_id=p_user or kind='appeal')) then raise exception 'Invalid associated case.' using errcode='23514'; end if;
  insert into public.control_enforcements(user_id,actor_id,kind,feature,reason,explanation,expires_at,case_id) values(p_user,auth.uid(),p_kind,p_feature,p_reason,p_explanation,p_until,p_case) returning id into result;
  perform app_private.control_audit('enforcement_'||p_kind,'enforcement',result,p_reason,null,jsonb_build_object('user',p_user,'feature',p_feature,'expires',p_until));
  perform app_private.control_notify(p_user,'An account restriction was issued',p_explanation,'/activity','enforcement:'||result);
  return result;
end; $$;
create function public.update_control_enforcement(p_id uuid,p_revoke boolean,p_until timestamptz,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare item public.control_enforcements;
begin
  select * into item from public.control_enforcements where id=p_id for update;
  if not found or not app_private.has_role('moderator') or exists(select 1 from public.admin_roles where user_id=item.user_id) or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Enforcement update unavailable.' using errcode='42501'; end if;
  update public.control_enforcements set revoked_at=case when p_revoke then now() end,revoked_by=case when p_revoke then auth.uid() end,expires_at=case when p_revoke then expires_at else p_until end where id=p_id;
  perform app_private.control_audit(case when p_revoke then 'enforcement_revoked' else 'enforcement_rescheduled' end,'enforcement',p_id,p_reason,to_jsonb(item));
  perform app_private.control_notify(item.user_id,'An account restriction was updated',p_reason,'/activity','enforcement_updated:'||p_id||':'||clock_timestamp());
end; $$;
create function public.mark_control_notifications(p_id uuid default null) returns void language sql security definer set search_path='' as $$
  update public.control_notifications set read_at=now() where recipient_id=auth.uid() and read_at is null and (p_id is null or id=p_id);
$$;
create function app_private.invitation_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform app_private.control_notify(new.invited_user_id,'Moderator invitation','Review your invitation to the SceneStack team.','/activity','moderator_invitation:'||new.id);
  return new;
end; $$;
create trigger admin_invitation_notice after insert on public.admin_invitations for each row execute function app_private.invitation_notice();

create function app_private.feature_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare feature text;
begin
  if auth.uid() is null then return new; end if;
  feature:=case tg_table_name when 'follows' then 'follow' when 'collection_favorites' then 'collection_interaction' when 'collection_saves' then 'collection_interaction' when 'missing_title_requests' then 'title_request' when 'metadata_corrections' then 'correction' when 'reports' then 'report' when 'collections' then case when to_jsonb(new)->>'visibility'='published' then 'publish' end end;
  if feature is not null and not app_private.can_use(feature) then raise exception 'This feature is temporarily restricted.' using errcode='42501'; end if;
  return new;
end; $$;
do $$ declare item text; begin
  foreach item in array array['follows','collection_favorites','collection_saves','missing_title_requests','metadata_corrections','reports','collections'] loop
    execute format('create trigger control_feature_guard before insert or update on public.%I for each row execute function app_private.feature_guard()',item);
  end loop;
end; $$;
-- All new operations default closed. Essential account cases use their own
-- authenticated checks rather than requiring an unrestricted member account.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['can_use','case_staff','read_case','control_notify','case_event','legacy_case','submit_control_case','reply_control_case','review_control_case','member_case_action','vote_title_request','browse_title_requests','enforce_control_account','update_control_enforcement','mark_control_notifications','invitation_notice','feature_guard']) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
end loop; end; $$;
grant execute on function app_private.case_staff(text),app_private.read_case(uuid,boolean),app_private.can_use(text) to authenticated;
grant execute on function public.submit_control_case(text,text,text,uuid,uuid,uuid,jsonb),public.reply_control_case(uuid,text,boolean),public.review_control_case(uuid,text,text,text,uuid,uuid,uuid),public.member_case_action(uuid,text,integer),public.vote_title_request(uuid,boolean),public.browse_title_requests(text,text,integer,integer),public.enforce_control_account(uuid,text,text,text,text,timestamptz,uuid),public.update_control_enforcement(uuid,boolean,timestamptz,text),public.mark_control_notifications(uuid) to authenticated;

$migration_202611250026$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250026' then raise exception 'Migration 202611250026 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250026','control_cases_enforcement',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250027_control_operations.sql; SHA256 1765b5c34741eb3dad4918de7719acdf8bbed24da5c794a43e2b0087fbb49d19
  if not '202611250027' = any(v_history) then
    execute $migration_202611250027$
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

$migration_202611250027$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250027' then raise exception 'Migration 202611250027 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250027','control_operations',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250028_control_catalog_management.sql; SHA256 e73150446f7abf5e454aa3feb6a97fcbad883b2281e085a94d2776d507cb19dc
  if not '202611250028' = any(v_history) then
    execute $migration_202611250028$
drop policy documents_read on public.control_documents;
create policy documents_public_read on public.control_documents for select to anon using(status='published' and audience='public' and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()));
create policy documents_member_read on public.control_documents for select to authenticated using(app_private.has_role('super_admin') or (status='published' and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now()) and (audience='public' or (audience='members' and app_private.member()) or (audience='administrators' and app_private.has_role('moderator')))));

create function app_private.title_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('title',to_jsonb(t)-'search_document','aliases',(select coalesce(jsonb_agg(name order by name),'[]') from public.title_names where title_id=t.id),
    'genres',(select coalesce(jsonb_agg(g.name order by g.name),'[]') from public.title_genres tg join public.genres g on g.id=tg.genre_id where tg.title_id=t.id),
    'countries',(select coalesce(jsonb_agg(country_code order by country_code),'[]') from public.title_countries where title_id=t.id),
    'languages',(select coalesce(jsonb_agg(language_code order by language_code),'[]') from public.title_languages where title_id=t.id),
    'poster',(select url from public.title_artwork where title_id=t.id and kind='poster' order by created_at desc,id limit 1),
    'backdrop',(select url from public.title_artwork where title_id=t.id and kind='backdrop' order by created_at desc,id limit 1)) from public.titles t where id=p_id;
$$;
create function app_private.locked_metadata_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare field text; identity uuid; payload jsonb;
begin
  if app_private.has_role('super_admin') then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_table_name='titles' then
    payload:=to_jsonb(new);
    for field in select field_name from public.metadata_locks where title_id=new.id and locked loop
      if payload ? field then payload:=jsonb_set(payload,array[field],to_jsonb(old)->field); end if;
    end loop;
    new:=jsonb_populate_record(new,payload-'search_document');
  else
    identity:=case when tg_op='DELETE' then old.title_id else new.title_id end;
    field:=case tg_table_name when 'title_genres' then 'genres' when 'title_names' then 'aliases' when 'title_countries' then 'countries' when 'title_languages' then 'languages' when 'title_artwork' then case when tg_op='DELETE' then to_jsonb(old)->>'kind' else to_jsonb(new)->>'kind' end end;
    if exists(select 1 from public.metadata_locks where title_id=identity and field_name=field and locked) then return null; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger control_metadata_scalar_locks before update on public.titles for each row execute function app_private.locked_metadata_guard();
do $$ declare item text; begin
  foreach item in array array['title_names','title_genres','title_countries','title_languages','title_artwork'] loop
    execute format('create trigger control_metadata_relation_locks before insert or update or delete on public.%I for each row execute function app_private.locked_metadata_guard()',item);
  end loop;
end; $$;
-- Existing protected scalar edits are migrated into the explicit field lock UI.
insert into public.metadata_locks(title_id,field_name,updated_by)
select distinct on (title_id,field_name) title_id,field_name,updated_by from public.metadata_provenance
where source_reference='manual_override' and field_name in ('display_title','original_title','description','kind','release_year','age_rating') order by title_id,field_name,retrieved_at desc on conflict do nothing;

create function public.control_edit_title(p_id uuid,p_patch jsonb,p_locks jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.titles; changed public.titles; previous jsonb; next_snapshot jsonb; result uuid:=p_id; field text; value jsonb; item text; genre_id uuid; provider uuid;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Catalog editing unavailable.' using errcode='42501'; end if;
  if jsonb_typeof(p_patch)<>'object' or jsonb_typeof(p_locks)<>'object' or octet_length(p_patch::text)>50000 then raise exception 'Invalid metadata patch.' using errcode='23514'; end if;
  for field in select jsonb_object_keys(p_patch) loop
    if field not in ('display_title','original_title','description','kind','edition','status','release_year','release_date','runtime_minutes','age_rating','genres','countries','languages','aliases','poster','backdrop') then raise exception 'Unsupported metadata field.' using errcode='23514'; end if;
    if field in ('genres','countries','languages','aliases') and (jsonb_typeof(p_patch->field)<>'array' or jsonb_array_length(p_patch->field)>100) then raise exception 'Invalid metadata list.' using errcode='23514'; end if;
  end loop;
  if p_id is null then
    insert into public.titles(display_title,kind,status,description) values(p_patch->>'display_title',(p_patch->>'kind')::public.entertainment_kind,coalesce(p_patch->>'status','announced')::public.catalog_status,coalesce(p_patch->>'description','')) returning id into result;
  end if;
  select * into existing from public.titles where id=result for update;
  if not found then raise exception 'Title not found.' using errcode='23514'; end if;
  if existing.status='merged' or p_patch->>'status'='merged' then raise exception 'Use reviewed merge and split operations for canonical redirects.' using errcode='23514'; end if;
  previous:=app_private.title_snapshot(result);
  changed:=jsonb_populate_record(existing,p_patch-array['genres','countries','languages','aliases','poster','backdrop']);
  update public.titles set display_title=changed.display_title,original_title=changed.original_title,description=changed.description,kind=changed.kind,edition=changed.edition,status=changed.status,release_year=changed.release_year,release_date=changed.release_date,runtime_minutes=changed.runtime_minutes,age_rating=changed.age_rating where id=result;
  for field,value in select * from jsonb_each(p_patch) loop
    if field='aliases' then
      delete from public.title_names where title_id=result and name_kind='alternative';
      for item in select jsonb_array_elements_text(value) loop insert into public.title_names(title_id,name,name_kind) values(result,item,'alternative') on conflict do nothing; end loop;
    elsif field='genres' then
      delete from public.title_genres where title_id=result;
      for item in select jsonb_array_elements_text(value) loop
        insert into public.genres(name) values(item) on conflict(name) do update set name=excluded.name returning id into genre_id;
        insert into public.title_genres values(result,genre_id) on conflict do nothing;
      end loop;
    elsif field='countries' then
      delete from public.title_countries where title_id=result;
      for item in select jsonb_array_elements_text(value) loop insert into public.title_countries values(result,item) on conflict do nothing; end loop;
    elsif field='languages' then
      delete from public.title_languages where title_id=result;
      for item in select jsonb_array_elements_text(value) loop insert into public.title_languages values(result,item) on conflict do nothing; end loop;
    elsif field in ('poster','backdrop') then
      if jsonb_typeof(value) not in ('string','null') then raise exception 'Invalid artwork value.' using errcode='23514'; end if;
      provider:=null;
      if value#>>'{}' is not null then
        select id into provider from public.metadata_providers where approved and enabled and ((key='tmdb' and value#>>'{}' ~ '^https://image[.]tmdb[.]org/t/p/(w500|w1280)/[A-Za-z0-9_-]+[.](jpg|png|webp)$') or (key='myanimelist' and value#>>'{}' ~ '^https://cdn[.]myanimelist[.]net/images/anime/[0-9]+/[0-9]+[.](jpg|png|webp)$'));
        if provider is null then raise exception 'Artwork must use an approved source.' using errcode='23514'; end if;
      end if;
      delete from public.title_artwork where title_id=result and kind=field;
      if provider is not null then insert into public.title_artwork(title_id,provider_id,kind,url,attribution) values(result,provider,field,value#>>'{}','Manually selected approved provider artwork'); end if;
    end if;
  end loop;
  -- Manual edits lock their fields by default; explicit false is an audited unlock.
  for field in select jsonb_object_keys(p_patch||p_locks) loop
    if p_locks ? field and jsonb_typeof(p_locks->field)<>'boolean' then raise exception 'Invalid metadata lock.' using errcode='23514'; end if;
    insert into public.metadata_locks(title_id,field_name,locked,updated_by) values(result,field,coalesce((p_locks->>field)::boolean,true),auth.uid())
    on conflict(title_id,field_name) do update set locked=excluded.locked,updated_by=excluded.updated_by,updated_at=now();
    if p_locks->>field='false' then delete from public.metadata_provenance where title_id=result and field_name=field and source_reference='manual_override'; end if;
  end loop;
  next_snapshot:=app_private.title_snapshot(result);
  insert into public.metadata_revisions(title_id,actor_id,reason,previous_state,next_state) values(result,auth.uid(),p_reason,previous,next_snapshot);
  perform app_private.control_audit('catalog_title_edited','title',result,p_reason,previous,next_snapshot);
  return result;
end; $$;
create function public.control_rollback_title(p_revision uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare revision public.metadata_revisions; patch jsonb;
begin
  if not app_private.has_role('super_admin') then raise exception 'Rollback unavailable.' using errcode='42501'; end if;
  select * into revision from public.metadata_revisions where id=p_revision;
  if not found or revision.previous_state is null then raise exception 'Revision cannot be restored.' using errcode='23514'; end if;
  patch:=(revision.previous_state->'title')-array['id','created_at','updated_at','search_document','parent_title_id','season_number','popularity'];
  patch:=patch||(revision.previous_state-'title'-'redirects');
  return public.control_edit_title(revision.title_id,patch,'{}',p_reason);
end; $$;
create function public.decide_correction_fields(p_id uuid,p_decisions jsonb,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare item public.control_cases; field text; approved boolean; patch jsonb:='{}'; accepted integer:=0; rejected integer:=0;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 or jsonb_typeof(p_decisions)<>'object' then raise exception 'Correction review unavailable.' using errcode='42501'; end if;
  select * into item from public.control_cases where id=p_id and kind='correction' for update;
  if not found or item.status in ('accepted','partially_accepted','rejected','withdrawn','merged') then raise exception 'Correction is no longer reviewable.' using errcode='23514'; end if;
  for field in select jsonb_object_keys(item.payload->'fields') loop
    if not (p_decisions ? field) or jsonb_typeof(p_decisions->field)<>'boolean' then raise exception 'Choose a decision for every proposed field.' using errcode='23514'; end if;
    approved:=(p_decisions->>field)::boolean;
    insert into public.correction_field_decisions(case_id,field_name,approved,reason,decided_by) values(p_id,field,approved,p_reason,auth.uid()) on conflict(case_id,field_name) do update set approved=excluded.approved,reason=excluded.reason,decided_by=excluded.decided_by,decided_at=now();
    if approved then patch:=patch||jsonb_build_object(field,item.payload->'fields'->field); accepted:=accepted+1; else rejected:=rejected+1; end if;
  end loop;
  if accepted>0 then perform public.control_edit_title(item.title_id,patch,'{}',p_reason); end if;
  update public.control_cases set status=case when accepted=0 then 'rejected' when rejected>0 then 'partially_accepted' else 'accepted' end,resolution=p_reason where id=p_id;
  if item.correction_id is not null then update public.metadata_corrections set status=case when accepted>0 then 'approved'::public.review_status else 'rejected'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_reason where id=item.correction_id; end if;
  perform app_private.control_audit('correction_fields_decided','case',p_id,p_reason,null,p_decisions);
end; $$;
create function public.control_merge_titles(p_source uuid,p_target uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb; request_id uuid;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Merge unavailable.' using errcode='42501'; end if;
  perform id from public.titles where id in (p_source,p_target) order by id for update;
  previous:=app_private.title_snapshot(p_source)||jsonb_build_object('redirects',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.title_redirects r where target_id=p_source));
  request_id:=public.propose_catalog_merge(p_source,p_target,p_reason);
  perform public.review_catalog_submission('merge',request_id,true,p_reason,null);
  insert into public.metadata_revisions(title_id,actor_id,reason,previous_state,next_state) values(p_source,auth.uid(),p_reason,previous,app_private.title_snapshot(p_source)||jsonb_build_object('mergeTarget',p_target));
  perform app_private.control_audit('titles_merged','title',p_source,p_reason,previous,jsonb_build_object('target',p_target));
end; $$;
create function public.control_split_title(p_source uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare revision public.metadata_revisions; redirect jsonb;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Split unavailable.' using errcode='42501'; end if;
  perform id from public.titles where id=p_source for update;
  select * into revision from public.metadata_revisions where title_id=p_source and next_state ? 'mergeTarget' order by created_at desc,id limit 1;
  if not found or not exists(select 1 from public.title_redirects where source_id=p_source) then raise exception 'No reversible reviewed merge was found.' using errcode='23514'; end if;
  delete from public.title_redirects where source_id=p_source;
  for redirect in select value from jsonb_array_elements(revision.previous_state->'redirects') loop update public.title_redirects set target_id=(redirect->>'target_id')::uuid where source_id=(redirect->>'source_id')::uuid; end loop;
  update public.titles set status=(revision.previous_state->'title'->>'status')::public.catalog_status where id=p_source;
  perform app_private.control_audit('title_split','title',p_source,p_reason,revision.next_state,app_private.title_snapshot(p_source));
end; $$;
create function public.control_collection_visibility(p_id uuid,p_hidden boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare item public.collections;
begin
  if not app_private.has_role('moderator') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Collection moderation unavailable.' using errcode='42501'; end if;
  select * into item from public.collections where id=p_id and visibility='published' for update;
  if not found or (not app_private.has_role('super_admin') and exists(select 1 from public.admin_roles where user_id=item.owner_id)) then raise exception 'Collection unavailable for moderation.' using errcode='42501'; end if;
  update public.collections set removed_at=case when p_hidden then now() end where id=p_id;
  perform app_private.control_audit(case when p_hidden then 'collection_hidden' else 'collection_restored' end,'collection',p_id,p_reason,jsonb_build_object('removed_at',item.removed_at));
  perform app_private.control_notify(item.owner_id,'A public collection was reviewed',p_reason,'/activity','collection_review:'||p_id||':'||clock_timestamp());
end; $$;

create or replace function app_private.guard_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.id<>new.id or (old.username is not null and old.username is distinct from new.username and not app_private.has_role('super_admin') and not (old.username_change_required and auth.uid()=old.id and not new.username_change_required)) then raise exception 'Permanent identity cannot be changed.' using errcode='23514'; end if;
  if new.avatar_path is not null and new.avatar_path !~ ('^' || new.id::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid avatar reference.' using errcode='23514'; end if;
  return new;
end; $$;
create function public.control_profile_action(p_user uuid,p_action text,p_value text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 or exists(select 1 from app_private.platform_owner where user_id=p_user) then raise exception 'Sensitive profile change unavailable.' using errcode='42501'; end if;
  select jsonb_build_object('username',username,'display_name',display_name,'bio',bio,'verified_at',verified_at,'status',status) into previous from public.profiles where id=p_user for update;
  if not found then raise exception 'Account not found.' using errcode='23514'; end if;
  if p_action='verify' then update public.profiles set verified_at=now(),verified_by=auth.uid() where id=p_user;
  elsif p_action='unverify' then update public.profiles set verified_at=null,verified_by=null where id=p_user;
  elsif p_action='clear_bio' then update public.profiles set bio='' where id=p_user;
  elsif p_action='clear_avatar' then update public.profiles set avatar_path=null where id=p_user;
  elsif p_action='clear_cover' then update public.profiles set cover_path=null where id=p_user;
  elsif p_action='display_name' then update public.profiles set display_name=p_value where id=p_user;
  elsif p_action='force_username' then update public.profiles set username_change_required=true where id=p_user;
  elsif p_action='restore' then
    if exists(select 1 from public.account_deletions where user_id=p_user) then raise exception 'Account deletion recovery requires the account owner’s fresh sign-in.' using errcode='42501'; end if;
    update public.profiles set status='active' where id=p_user;
    update public.control_enforcements set revoked_at=now(),revoked_by=auth.uid() where user_id=p_user and revoked_at is null and kind in ('ban','suspension');
  elsif p_action='delete' then
    if exists(select 1 from public.admin_roles where user_id=p_user) then raise exception 'Remove the administrative appointment first.' using errcode='42501'; end if;
    insert into public.account_deletions(user_id) values(p_user) on conflict do nothing;
    update public.profiles set status='deletion_pending' where id=p_user;
  else raise exception 'Invalid profile operation.' using errcode='23514'; end if;
  perform app_private.control_audit('profile_'||p_action,'profile',p_user,p_reason,previous);
  perform app_private.control_notify(p_user,'Your account was reviewed',p_reason,'/activity','profile_review:'||p_user||':'||clock_timestamp());
end; $$;
create function public.change_required_username(p_username text) returns void language plpgsql security definer set search_path='' as $$
declare candidate text:=lower(btrim(p_username)); who uuid:=app_private.require_member();
begin
  if candidate !~ '^[a-z][a-z0-9_]{2,29}$' or candidate in ('admin','administrator','moderator','scenestack','support','official') then raise exception 'Choose another username.' using errcode='23514'; end if;
  update public.profiles set username=candidate,username_change_required=false where id=who and username_change_required;
  if not found then raise exception 'Username change unavailable.' using errcode='42501'; end if;
end; $$;
create function public.control_support_template(p_id uuid,p_title text,p_body text,p_remove boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('moderator') then raise exception 'Support template unavailable.' using errcode='42501'; end if;
  if p_remove then delete from public.support_templates where id=p_id returning id into result;
  elsif p_id is null then insert into public.support_templates(title,body,created_by) values(p_title,p_body,auth.uid()) returning id into result;
  else update public.support_templates set title=p_title,body=p_body,updated_at=now() where id=p_id returning id into result; end if;
  if result is null then raise exception 'Template not found.' using errcode='23514'; end if;
  perform app_private.control_audit('support_template_changed','support_template',result,'Support response template'); return result;
end; $$;
create function public.control_account_access() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('active',app_private.active(auth.uid()),'status',p.status,'usernameChangeRequired',p.username_change_required,
    'maintenance',(select settings->'maintenance' from public.platform_settings where singleton),'registration',(select settings->'registration' from public.platform_settings where singleton),
    'restrictions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'feature',feature,'explanation',explanation,'startsAt',starts_at,'expiresAt',expires_at)),'[]') from public.control_enforcements where user_id=auth.uid() and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()))) from public.profiles p where p.id=auth.uid();
$$;

do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['title_snapshot','locked_metadata_guard','control_edit_title','control_rollback_title','decide_correction_fields','control_merge_titles','control_split_title','control_collection_visibility','control_profile_action','change_required_username','control_support_template','control_account_access']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
end loop; end; $$;
grant execute on function public.control_edit_title(uuid,jsonb,jsonb,text),public.control_rollback_title(uuid,text),public.decide_correction_fields(uuid,jsonb,text),public.control_merge_titles(uuid,uuid,text),public.control_split_title(uuid,text),public.control_collection_visibility(uuid,boolean,text),public.control_profile_action(uuid,text,text,text),public.change_required_username(text),public.control_support_template(uuid,text,text,boolean),public.control_account_access() to authenticated;

$migration_202611250028$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250028' then raise exception 'Migration 202611250028 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250028','control_catalog_management',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250029_control_workspaces.sql; SHA256 1eaf1f43c7d0f34985b20184a5db1bb8f9d726b2b36b643fac0b110c4a87da16
  if not '202611250029' = any(v_history) then
    execute $migration_202611250029$
drop policy provider_attribution_read on public.metadata_providers;
create policy provider_attribution_read on public.metadata_providers for select to anon,authenticated using(approved and enabled);
create table app_private.activity_days(user_id uuid references public.profiles(id) on delete cascade,day date not null default current_date,primary key(user_id,day));
alter table app_private.activity_days enable row level security;
revoke all on app_private.activity_days from public,anon,authenticated,service_role;
create function public.record_platform_activity() returns void language plpgsql security definer set search_path='' as $$
begin
  if app_private.member() then insert into app_private.activity_days(user_id) values(auth.uid()) on conflict do nothing; end if;
  delete from app_private.activity_days where day<current_date-90;
end; $$;
create function public.record_catalog_search(p_query text,p_category text,p_empty boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted metrics recorder required.' using errcode='42501'; end if;
  if char_length(p_query) not between 3 and 120 or p_query ~ '[@:/]' or p_query ~ '[[:cntrl:]]' or p_category not in ('','anime','movie','series','cartoon','drama','documentary') then return; end if;
  insert into public.search_daily_metrics(day,query,category,searches,no_results) values(current_date,lower(btrim(p_query)),p_category,1,case when p_empty then 1 else 0 end)
  on conflict(day,query,category) do update set searches=public.search_daily_metrics.searches+1,no_results=public.search_daily_metrics.no_results+excluded.no_results;
  delete from public.search_daily_metrics where day<current_date-90;
end; $$;
create or replace function app_private.can_use(p_feature text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member()
    and (p_feature not in ('publish','follow','collection_interaction') or app_private.has_role('moderator') or not exists(select 1 from public.platform_settings where singleton and settings->>'community'='false'))
    and not exists(select 1 from public.control_enforcements e where e.user_id=auth.uid() and e.kind='restriction' and e.feature=p_feature and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()));
$$;
create function app_private.registration_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.platform_settings where singleton and settings->>'registration'='false') then raise exception 'New registration is temporarily unavailable.' using errcode='42501'; end if;
  return new;
end; $$;
create trigger control_registration_guard before insert on public.profiles for each row execute function app_private.registration_guard();

create function public.control_workspace(p_section text,p_query text default '',p_status text default null,p_page integer default 1,p_from date default null,p_to date default null,p_assignment text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb:='[]'; total bigint:=0; metrics jsonb:='{}'; series jsonb:='{}'; kind_filter text; offset_rows integer:=(p_page-1)*24; super boolean:=app_private.has_role('super_admin');
begin
  if not app_private.has_role('moderator') then raise exception 'Control Center access required.' using errcode='42501'; end if;
  if char_length(p_query)>120 or p_page not between 1 and 10000 or (p_from is not null and p_to is not null and (p_to<p_from or p_to-p_from>366)) then raise exception 'Invalid workspace filters.' using errcode='23514'; end if;
  if p_section not in ('overview','action-center','analytics','users','reports','collections','appeals','support','catalog','title-requests','corrections','duplicates','content-studio','synchronization','providers','health','jobs','announcements','team','audit','settings','help','templates') then raise exception 'Workspace not found.' using errcode='23514'; end if;
  if not super and p_section not in ('overview','action-center','users','reports','collections','appeals','support','audit','templates') then raise exception 'Super Admin access required.' using errcode='42501'; end if;
  if p_section in ('overview','analytics') then
    metrics:=jsonb_build_object('users',(select count(*) from public.profiles where status<>'purging'),'publicCollections',(select count(*) from public.collections where visibility='published' and removed_at is null),
      'pendingReports',(select count(*) from public.control_cases where kind='report' and status in ('submitted','under_review','awaiting_information','reopened')),
      'openSupport',(select count(*) from public.control_cases where kind='support' and status not in ('resolved','closed','withdrawn')),
      'pendingAppeals',(select count(*) from public.control_cases where kind='appeal' and status in ('submitted','under_review','awaiting_information','reopened')));
    if super then
      metrics:=metrics||jsonb_build_object('titles',(select count(*) from public.titles where status<>'merged'),'activeUsers',(select count(distinct user_id) from app_private.activity_days where day between coalesce(p_from,current_date-29) and coalesce(p_to,current_date)),
        'pendingRequests',(select count(*) from public.control_cases where kind='title_request' and status in ('submitted','under_review','awaiting_information','approved_pending_publication')),
        'pendingCorrections',(select count(*) from public.control_cases where kind='correction' and status in ('submitted','under_review','awaiting_information')),
        'activeJobs',(select count(*) from public.catalog_jobs where state='running'),'failedJobs',(select count(*) from public.catalog_jobs where state='failed'),
        'importedToday',(select count(*) from public.titles where created_at>=current_date and status<>'merged'));
      series:=jsonb_build_object('growth',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select d::date as day,
        (select count(*) from public.profiles where created_at>=d and created_at<d+interval '1 day') users,
        (select count(*) from public.titles where created_at>=d and created_at<d+interval '1 day' and status<>'merged') titles
        from generate_series(coalesce(p_from,current_date-29)::timestamp,coalesce(p_to,current_date)::timestamp,interval '1 day') d) r),
        'engagement',(select coalesce(jsonb_agg(to_jsonb(m) order by day),'[]') from public.platform_daily_metrics m where day between coalesce(p_from,current_date-29) and coalesce(p_to,current_date)),
        'categories',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select kind,count(*) count from public.titles where status<>'merged' group by kind order by count(*) desc) r),
        'searches',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select query,sum(searches) searches,sum(no_results) no_results from public.search_daily_metrics where day between coalesce(p_from,current_date-29) and coalesce(p_to,current_date) group by query order by sum(searches) desc limit 20) r),
        'workload',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select kind,status,count(*) count from public.control_cases group by kind,status order by kind,status) r));
    end if;
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,actor_id,actor_role,action,entity_type,entity_id,reason,created_at from public.audit_logs where super or actor_id=auth.uid() order by created_at desc,id limit 12) r);
  elsif p_section in ('action-center','reports','appeals','support','title-requests','corrections') then
    kind_filter:=case p_section when 'reports' then 'report' when 'appeals' then 'appeal' when 'support' then 'support' when 'title-requests' then 'title_request' when 'corrections' then 'correction' end;
    select count(*) into total from public.control_cases c where app_private.case_staff(c.kind) and (kind_filter is null or c.kind=kind_filter) and (p_status is null or c.status=p_status)
      and (p_assignment is null or (p_assignment='mine' and c.assigned_to=auth.uid()) or (p_assignment='unassigned' and c.assigned_to is null))
      and (p_query='' or c.subject ilike '%'||p_query||'%' or c.id::text=p_query) and c.created_at::date between coalesce(p_from,'1970-01-01') and coalesce(p_to,current_date);
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select c.id,c.kind,c.owner_id,c.subject,c.status,c.priority,c.assigned_to,c.grouped_into,c.due_at,c.created_at,c.updated_at from public.control_cases c where app_private.case_staff(c.kind) and (kind_filter is null or c.kind=kind_filter) and (p_status is null or c.status=p_status)
      and (p_assignment is null or (p_assignment='mine' and c.assigned_to=auth.uid()) or (p_assignment='unassigned' and c.assigned_to is null))
      and (p_query='' or c.subject ilike '%'||p_query||'%' or c.id::text=p_query) and c.created_at::date between coalesce(p_from,'1970-01-01') and coalesce(p_to,current_date)
      order by case c.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,c.created_at,c.id limit 24 offset offset_rows) r);
  elsif p_section='users' then
    select count(*) into total from public.profiles p where (p_query='' or p.display_name ilike '%'||p_query||'%' or p.username ilike '%'||p_query||'%' or p.id::text=p_query) and (p_status is null or p.status::text=p_status or (p_status='verified' and p.verified_at is not null) or (p_status='administrators' and exists(select 1 from public.admin_roles where user_id=p.id)) or (p_status='restricted' and exists(select 1 from public.control_enforcements where user_id=p.id and revoked_at is null and (expires_at is null or expires_at>now()))));
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select p.id,p.display_name,p.username,p.status,p.avatar_path,p.created_at,p.verified_at,
      (select role from public.admin_roles where user_id=p.id order by role limit 1) admin_role,
      (select count(*) from public.collections where owner_id=p.id and visibility='published' and removed_at is null) public_collections
      from public.profiles p where (p_query='' or p.display_name ilike '%'||p_query||'%' or p.username ilike '%'||p_query||'%' or p.id::text=p_query) and (p_status is null or p.status::text=p_status or (p_status='verified' and p.verified_at is not null) or (p_status='administrators' and exists(select 1 from public.admin_roles where user_id=p.id)) or (p_status='restricted' and exists(select 1 from public.control_enforcements where user_id=p.id and revoked_at is null and (expires_at is null or expires_at>now())))) order by p.created_at desc,p.id limit 24 offset offset_rows) r);
  elsif p_section='catalog' then
    select count(*) into total from public.titles t where (p_query='' or t.display_title ilike '%'||p_query||'%' or t.original_title ilike '%'||p_query||'%' or t.id::text=p_query) and (p_status is null or t.kind::text=p_status or t.status::text=p_status);
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select t.id,t.display_title,t.kind,t.edition,t.status,t.release_year,t.updated_at,t.created_at,
      (select url from public.title_artwork where title_id=t.id and kind='poster' order by created_at desc,id limit 1) poster,
      (select string_agg(distinct p.name,', ') from public.provider_title_ids i join public.metadata_providers p on p.id=i.provider_id where i.title_id=t.id) providers,
      (select max(last_success_at) from public.provider_sync_state where title_id=t.id) last_sync,
      (select count(*) from public.metadata_locks where title_id=t.id and locked) locked_fields,
      ((case when t.description<>'' then 1 else 0 end)+(case when t.release_year is not null then 1 else 0 end)+(case when exists(select 1 from public.title_artwork where title_id=t.id and kind='poster') then 1 else 0 end)+(case when exists(select 1 from public.title_genres where title_id=t.id) then 1 else 0 end)) completeness
      from public.titles t where (p_query='' or t.display_title ilike '%'||p_query||'%' or t.original_title ilike '%'||p_query||'%' or t.id::text=p_query) and (p_status is null or t.kind::text=p_status or t.status::text=p_status) order by t.updated_at desc,t.id limit 24 offset offset_rows) r);
  elsif p_section='collections' then
    select count(*) into total from public.collections where visibility='published' and (p_query='' or title ilike '%'||p_query||'%') and (p_status is null or (p_status='hidden' and removed_at is not null) or (p_status='published' and removed_at is null));
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select c.id,c.title,c.owner_id,c.cover_path,c.published_at,c.removed_at,
      (select username from public.profiles where id=c.owner_id) creator,
      (select count(*) from public.collection_items where collection_id=c.id) title_count,
      (select count(*) from public.collection_favorites where collection_id=c.id) favorites,
      (select count(*) from public.collection_saves where collection_id=c.id) saves,
      (select count(*) from public.collection_imports where source_collection_id=c.id) imports,
      (select count(*) from public.control_cases where collection_id=c.id and kind='report') reports
      from public.collections c where c.visibility='published' and (p_query='' or c.title ilike '%'||p_query||'%') and (p_status is null or (p_status='hidden' and c.removed_at is not null) or (p_status='published' and c.removed_at is null)) order by c.created_at desc,c.id limit 24 offset offset_rows) r);
  elsif p_section='team' then
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select a.user_id id,a.role,a.granted_at,a.suspended_at,a.suspension_reason,p.username,p.display_name from public.admin_roles a join public.profiles p on p.id=a.user_id order by a.role,a.granted_at) r);
    metrics:=jsonb_build_object('maximumModerators',5,'invitations',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select i.id,i.invited_user_id,i.status,i.reason,i.created_at,i.expires_at,p.username,p.display_name from public.admin_invitations i join public.profiles p on p.id=i.invited_user_id where i.status='pending' and i.expires_at>now() order by i.created_at) r));
  elsif p_section in ('synchronization','jobs') then
    select count(*) into total from public.catalog_jobs where (p_status is null or state=p_status);
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select j.*,p.name provider_name from public.catalog_jobs j join public.metadata_providers p on p.id=j.provider_id where p_status is null or j.state=p_status order by j.created_at desc,j.id limit 24 offset offset_rows) r);
    metrics:=jsonb_build_object('canonicalTitles',(select count(*) from public.titles where status<>'merged'),'target',50000,
      'categories',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select kind,count(*) count from public.titles where status<>'merged' group by kind) r),
      'providers',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select p.key,count(distinct i.title_id) titles from public.metadata_providers p left join public.provider_title_ids i on i.provider_id=p.id group by p.key) r),
      'schedules',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.catalog_schedules s),
      'failures',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select f.* from public.catalog_job_failures f where resolved_at is null order by created_at desc limit 24) r));
  elsif p_section='providers' then
    rows:=(select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name,'approved',approved,'enabled',enabled,'bulk_approved',bulk_approved,'attribution',attribution,'terms_url',terms_url)),'[]') from public.metadata_providers);
  elsif p_section='health' then
    metrics:=jsonb_build_object('database',jsonb_build_object('status','operational','checkedAt',now()),'capacity',null,'storageUsage',null,
      'refreshQueue',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select state,count(*) count from public.metadata_refresh_requests group by state) r),
      'schedulerLastMetricCapture',(select max(captured_at) from public.platform_daily_metrics));
  elsif p_section in ('content-studio','announcements','help') then
    kind_filter:=case p_section when 'content-studio' then 'editorial' when 'announcements' then 'announcement' else 'help' end;
    select count(*) into total from public.control_documents where kind=kind_filter and (p_status is null or status=p_status) and (p_query='' or title ilike '%'||p_query||'%');
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.control_documents where kind=kind_filter and (p_status is null or status=p_status) and (p_query='' or title ilike '%'||p_query||'%') order by updated_at desc,id limit 24 offset offset_rows) r);
  elsif p_section='templates' then
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.support_templates where p_query='' or title ilike '%'||p_query||'%' order by updated_at desc limit 24 offset offset_rows) r);
  elsif p_section='duplicates' then
    select count(*) into total from public.catalog_merge_requests;
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select m.*,s.display_title source_title,t.display_title target_title,s.release_year source_year,t.release_year target_year from public.catalog_merge_requests m join public.titles s on s.id=m.source_id join public.titles t on t.id=m.target_id order by m.created_at desc limit 24 offset offset_rows) r);
    metrics:=jsonb_build_object('candidates',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select a.id source_id,b.id target_id,a.display_title,a.release_year,a.kind from public.titles a join public.titles b on lower(a.display_title)=lower(b.display_title) and a.kind=b.kind and a.release_year is not distinct from b.release_year and a.id<b.id where a.status<>'merged' and b.status<>'merged' limit 24) r));
  elsif p_section='audit' then
    select count(*) into total from public.audit_logs where (super or actor_id=auth.uid()) and (p_query='' or action ilike '%'||p_query||'%' or entity_id::text=p_query or actor_id::text=p_query) and (p_status is null or outcome=p_status) and created_at::date between coalesce(p_from,'1970-01-01') and coalesce(p_to,current_date);
    rows:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select * from public.audit_logs where (super or actor_id=auth.uid()) and (p_query='' or action ilike '%'||p_query||'%' or entity_id::text=p_query or actor_id::text=p_query) and (p_status is null or outcome=p_status) and created_at::date between coalesce(p_from,'1970-01-01') and coalesce(p_to,current_date) order by created_at desc,id limit 24 offset offset_rows) r);
  elsif p_section='settings' then metrics:=(select settings from public.platform_settings where singleton);
  end if;
  return jsonb_build_object('rows',coalesce(rows,'[]'),'total',total,'page',p_page,'hasMore',total>p_page*24,'metrics',metrics,'series',series,'checkedAt',now());
end; $$;

create function public.control_user_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_role('moderator') then raise exception 'User investigation unavailable.' using errcode='42501'; end if;
  return jsonb_build_object('profile',(select to_jsonb(p)-'email' from public.profiles p where id=p_id),
    'roles',(select coalesce(jsonb_agg(jsonb_build_object('role',role,'suspendedAt',suspended_at,'appointedAt',granted_at)),'[]') from public.admin_roles where user_id=p_id),
    'collections',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,title,removed_at,published_at from public.collections where owner_id=p_id and visibility='published' order by created_at desc limit 24) r),
    'enforcements',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from public.control_enforcements e where user_id=p_id),
    'cases',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,kind,subject,status,created_at from public.control_cases where app_private.case_staff(kind) and (target_user_id=p_id or (owner_id=p_id and kind in ('appeal','support'))) order by created_at desc limit 24) r));
end; $$;
create function public.control_search_accounts(p_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.has_role('super_admin') then raise exception 'Team account search unavailable.' using errcode='42501'; end if;
  if char_length(btrim(p_query)) not between 3 and 120 then return '[]'; end if;
  -- Registered email is matched exactly, never read from editable metadata.
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select p.id,p.username,p.display_name,p.status,u.email from public.profiles p join auth.users u on u.id=p.id
    where p.username ilike '%'||p_query||'%' or p.id::text=p_query or lower(u.email)=lower(p_query) order by p.username nulls last,p.id limit 20) r);
end; $$;
create function public.control_search(p_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare results jsonb:='[]';
begin
  if not app_private.has_role('moderator') then raise exception 'Administrator search unavailable.' using errcode='42501'; end if;
  if char_length(btrim(p_query)) not between 2 and 120 then return results; end if;
  results:=(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,display_name label,'user' resource,'/admin/users/'||id href from public.profiles where username ilike '%'||p_query||'%' or display_name ilike '%'||p_query||'%' order by created_at desc limit 8) r);
  results:=results||(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,subject label,kind resource,'/admin/action-center/'||id href from public.control_cases where app_private.case_staff(kind) and subject ilike '%'||p_query||'%' order by created_at desc limit 12) r);
  if app_private.has_role('super_admin') then results:=results||(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,display_title label,'title' resource,'/admin/catalog/'||id href from public.titles where display_title ilike '%'||p_query||'%' order by popularity desc nulls last limit 8) r); end if;
  return results;
end; $$;
create function public.control_provider_switch(p_id uuid,p_enabled boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Provider configuration unavailable.' using errcode='42501'; end if;
  update public.metadata_providers set enabled=p_enabled where id=p_id and (not p_enabled or approved);
  if not found then raise exception 'Provider approval is required.' using errcode='42501'; end if;
  perform app_private.control_audit('provider_switch_changed','provider',p_id,p_reason,null,jsonb_build_object('enabled',p_enabled));
end; $$;

create function app_private.flag_public_content() returns trigger language plpgsql security definer set search_path='' as $$
declare text_value text; member_id uuid; resource_id uuid; rule text;
begin
  if tg_table_name='profiles' then text_value:=new.display_name||' '||coalesce(new.username,'')||' '||new.bio;member_id:=new.id;resource_id:=new.id;
  elsif tg_table_name='collections' then if new.visibility<>'published' then return new; end if; text_value:=new.title||' '||new.description;member_id:=new.owner_id;resource_id:=new.id;
  else if new.kind='flag' then return new; end if;text_value:=new.subject||' '||new.description;member_id:=new.owner_id;resource_id:=new.id; end if;
  if text_value ~* '(https?://[^[:space:]]+[[:space:]]*){5,}' then rule:='Repeated links: possible spam';
  elsif text_value ~* '(kill yourself|death threat|official scenestack support)' then rule:='Potential abuse or impersonation: phrase match';
  else return new; end if;
  if not exists(select 1 from public.control_cases where kind='flag' and target_user_id=member_id and payload->>'resourceId'=resource_id::text and payload->>'rule'=rule and status not in ('resolved','dismissed')) then
    insert into public.control_cases(kind,subject,description,target_user_id,payload) values('flag',rule,'Deterministic phrase/link heuristic. Human review is required; no punishment was applied.',member_id,jsonb_build_object('rule',rule,'resourceId',resource_id,'resourceType',tg_table_name,'context',left(text_value,3000),'detectedAt',now()));
  end if;
  return new;
end; $$;
create trigger control_profile_flags after insert or update of display_name,username,bio on public.profiles for each row execute function app_private.flag_public_content();
create trigger control_collection_flags after insert or update of title,description,visibility on public.collections for each row execute function app_private.flag_public_content();
create trigger control_submission_flags after insert on public.control_cases for each row execute function app_private.flag_public_content();

do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['record_platform_activity','record_catalog_search','registration_guard','control_workspace','control_user_detail','control_search_accounts','control_search','control_provider_switch','flag_public_content']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
end loop; end; $$;
grant execute on function public.record_platform_activity(),public.control_workspace(text,text,text,integer,date,date,text),public.control_user_detail(uuid),public.control_search_accounts(text),public.control_search(text),public.control_provider_switch(uuid,boolean,text) to authenticated;
grant execute on function public.record_catalog_search(text,text,boolean) to service_role;

$migration_202611250029$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250029' then raise exception 'Migration 202611250029 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250029','control_workspaces',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250030_control_completion.sql; SHA256 94a217ec9ad58d0bdbb21d1680f5da96dab831527a8c703949c74412c0b76b13
  if not '202611250030' = any(v_history) then
    execute $migration_202611250030$
create table public.admin_user_notes (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id),body text not null check(char_length(btrim(body)) between 1 and 10000),created_at timestamptz not null default now()
);
alter table public.admin_user_notes enable row level security;
revoke all on public.admin_user_notes from public,anon,authenticated;
grant select on public.admin_user_notes to authenticated;
grant all on public.admin_user_notes to service_role;
create policy staff_user_notes_read on public.admin_user_notes for select to authenticated using(app_private.has_role('moderator'));
create index admin_user_notes_user on public.admin_user_notes(user_id,created_at desc,id);
create function public.control_add_user_note(p_user uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('moderator') then raise exception 'Staff notes unavailable.' using errcode='42501'; end if;
  insert into public.admin_user_notes(user_id,actor_id,body) values(p_user,auth.uid(),p_body) returning id into result;
  perform app_private.control_audit('user_note_added','profile',p_user,'Confidential staff note recorded');return result;
end; $$;
create function public.control_restore_account(p_user uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.has_role('moderator') or char_length(btrim(p_reason)) not between 1 and 3000 or exists(select 1 from public.admin_roles where user_id=p_user) or exists(select 1 from public.account_deletions where user_id=p_user) then raise exception 'Restoration unavailable.' using errcode='42501'; end if;
  update public.profiles set status='active' where id=p_user and status in ('active','suspended','banned');
  if not found then raise exception 'Account is not restorable through moderation.' using errcode='23514'; end if;
  update public.control_enforcements set revoked_at=now(),revoked_by=auth.uid() where user_id=p_user and revoked_at is null and kind in ('suspension','ban');
  perform app_private.control_audit('account_restored','profile',p_user,p_reason);
  perform app_private.control_notify(p_user,'Account access restored',p_reason,'/activity','account_restored:'||p_user||':'||clock_timestamp());
end; $$;
create function app_private.control_rate_limit(p_bucket text,p_max integer,p_window interval) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); counter integer; stamp timestamptz;
begin
  if who is null or not exists(select 1 from public.profiles where id=who and status<>'purging') then raise exception 'Account required.' using errcode='42501'; end if;
  stamp:=to_timestamp(floor(extract(epoch from clock_timestamp())/extract(epoch from p_window))*extract(epoch from p_window));
  insert into app_private.rate_limits(user_id,bucket,window_start,count) values(who,p_bucket,stamp,1)
  on conflict(user_id,bucket,window_start) do update set count=app_private.rate_limits.count+1 returning count into counter;
  if counter>p_max then raise exception 'Please retry later.' using errcode='P0001'; end if;
end; $$;
create function public.resolve_control_appeal(p_id uuid,p_decision text,p_reason text,p_until timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare item public.control_cases; enforcement public.control_enforcements;
begin
  select * into item from public.control_cases where id=p_id and kind='appeal' for update;
  if not found or not app_private.has_role('moderator') or item.status not in ('submitted','under_review','awaiting_information','reopened') then raise exception 'Appeal review unavailable.' using errcode='42501'; end if;
  select * into enforcement from public.control_enforcements where id=item.enforcement_id for update;
  if not found then raise exception 'Associated enforcement not found.' using errcode='23514'; end if;
  if p_decision='accepted' then perform public.update_control_enforcement(enforcement.id,true,null,p_reason);
  elsif p_decision='partially_accepted' then
    if p_until is null or p_until<=now() or (enforcement.expires_at is not null and p_until>=enforcement.expires_at) then raise exception 'Choose an earlier future expiry.' using errcode='23514'; end if;
    perform public.update_control_enforcement(enforcement.id,false,p_until,p_reason);
  elsif p_decision<>'rejected' then raise exception 'Invalid appeal decision.' using errcode='23514'; end if;
  perform public.review_control_case(p_id,p_decision,p_reason,item.priority,item.assigned_to,null,null);
  perform app_private.control_audit('appeal_resolved','case',p_id,p_reason,null,jsonb_build_object('decision',p_decision));
end; $$;
drop policy control_owner_read on public.correction_field_decisions;
create policy correction_decisions_read on public.correction_field_decisions for select to authenticated using(app_private.has_role('super_admin') or exists(select 1 from public.control_cases where id=case_id and owner_id=auth.uid()));
create function public.control_bulk_category(p_ids uuid[],p_category public.entertainment_kind,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare title_id uuid;
begin
  if not app_private.has_role('super_admin') or p_ids is null or cardinality(p_ids) not between 1 and 20 then raise exception 'Bounded catalog editing unavailable.' using errcode='42501'; end if;
  for title_id in select distinct id from unnest(p_ids) id order by id loop
    perform public.control_edit_title(title_id,jsonb_build_object('kind',p_category),'{}',p_reason);
  end loop;
end; $$;
create function public.retry_catalog_failures(p_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.catalog_jobs; result uuid;
begin
  if not app_private.has_role('super_admin') or char_length(btrim(p_reason)) not between 1 and 3000 then raise exception 'Retry unavailable.' using errcode='42501'; end if;
  select * into item from public.catalog_jobs where id=p_id;
  if not found or not exists(select 1 from public.metadata_providers where id=item.provider_id and approved and enabled and bulk_approved) then raise exception 'Provider bulk permission unavailable.' using errcode='42501'; end if;
  if not exists(select 1 from public.catalog_job_failures where job_id=p_id and resolved_at is null) then raise exception 'No unresolved item failures.' using errcode='23514'; end if;
  insert into public.catalog_jobs(provider_id,kind,query,created_by) values(item.provider_id,'refresh',item.query||jsonb_build_object('retryOf',p_id),auth.uid()) returning id into result;
  perform app_private.control_audit('failed_records_requeued','catalog_job',result,p_reason);return result;
end; $$;
create function public.control_import_audit(p_title uuid,p_source text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.has_role('super_admin') or p_source not in ('tmdb.movie','tmdb.tv','myanimelist.anime') or not exists(select 1 from public.provider_title_ids where title_id=p_title) then raise exception 'Import audit unavailable.' using errcode='42501'; end if;
  perform app_private.control_audit('provider_title_imported','title',p_title,'Explicit provider import: '||p_source);
end; $$;

create function public.control_member_export() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); output jsonb; table_name text; payload jsonb;
begin
  if who is null or not exists(select 1 from public.profiles where id=who and status<>'purging') then raise exception 'Account export unavailable.' using errcode='42501'; end if;
  perform app_private.control_rate_limit('export_download',2,interval '1 hour');
  output:=jsonb_build_object('exported_at',now(),'profile',(select to_jsonb(p) from public.profiles p where id=who));
  foreach table_name in array array['onboarding','notification_preferences','recommendation_preferences','preferred_categories','favorite_genres','preferred_languages','tracking','tracking_history','ratings','rating_history','favorites','collection_imports','data_export_requests','title_feedback','recent_titles','recent_searches','title_request_votes'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where user_id=$1',table_name) into payload using who;
    output:=output||jsonb_build_object(table_name,payload);
  end loop;
  return output||jsonb_build_object(
    'collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.collections c where owner_id=who),
    'collection_items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.collection_items i join public.collections c on c.id=i.collection_id where c.owner_id=who),
    'collection_saves',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_saves s where user_id=who),
    'collection_favorites',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_favorites s where user_id=who),
    'follows',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.follows f where follower_id=who),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.blocks b where blocker_id=who),
    'reports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'details',details,'status',status,'created_at',created_at)),'[]') from public.reports where reporter_id=who),
    'activity',(select coalesce(jsonb_agg(to_jsonb(c)-'assigned_to'-'grouped_into'),'[]') from public.control_cases c where owner_id=who),
    'activity_messages',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.control_messages m join public.control_cases c on c.id=m.case_id where c.owner_id=who and not m.internal),
    'account_actions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'feature',feature,'explanation',explanation,'starts_at',starts_at,'expires_at',expires_at,'revoked_at',revoked_at)),'[]') from public.control_enforcements where user_id=who),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.notifications n where recipient_id=who and (n.actor_id is null or app_private.active(n.actor_id))),
    'platform_notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.control_notifications n where recipient_id=who),
    'moderator_invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'created_at',created_at,'expires_at',expires_at,'responded_at',responded_at)),'[]') from public.admin_invitations where invited_user_id=who));
end; $$;
create function public.control_request_deletion() returns timestamptz language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); deadline timestamptz;
begin
  if who is null or not exists(select 1 from public.profiles where id=who and status<>'purging') or exists(select 1 from public.admin_roles where user_id=who) or exists(select 1 from app_private.platform_owner where user_id=who) then raise exception 'End the administrative appointment before requesting account deletion.' using errcode='42501'; end if;
  perform app_private.control_rate_limit('delete_request',3,interval '1 day');
  insert into public.account_deletions(user_id) values(who) on conflict do nothing;
  update public.profiles set status='deletion_pending' where id=who;
  select recover_until into deadline from public.account_deletions where user_id=who;
  return deadline;
end; $$;

create or replace function public.admin_account_action(p_user uuid,p_action public.moderation_kind,p_reason text,p_until timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.enforce_control_account(p_user,p_action::text,p_reason,p_reason,null,p_until,null);
end; $$;
create or replace function public.moderate_report(p_report uuid,p_action public.moderation_kind,p_reason text,p_until timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare item public.reports; case_record public.control_cases; target uuid;
begin
  if not app_private.has_role('moderator') then raise exception 'Moderation unavailable.' using errcode='42501'; end if;
  select * into item from public.reports where id=p_report and status='pending' for update;
  if not found then raise exception 'Report not reviewable.' using errcode='23514'; end if;
  select * into case_record from public.control_cases where report_id=p_report for update;
  if case_record.status='withdrawn' then raise exception 'This report was withdrawn.' using errcode='23514'; end if;
  if p_action='content_removal' then perform public.control_collection_visibility(item.collection_id,true,p_reason);
  elsif p_action<>'dismissal' then
    target:=coalesce(item.target_user_id,(select owner_id from public.collections where id=item.collection_id and visibility='published'));
    perform public.enforce_control_account(target,p_action::text,p_reason,p_reason,null,p_until,case_record.id);
  end if;
  update public.reports set status=case when p_action='dismissal' then 'rejected'::public.review_status else 'approved'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_reason where id=p_report;
  perform public.review_control_case(case_record.id,case when p_action='dismissal' then 'dismissed' else 'resolved' end,p_reason,case_record.priority,case_record.assigned_to,null,null);
  perform app_private.control_audit('report_moderated','report',p_report,p_reason,null,jsonb_build_object('caseId',case_record.id,'action',p_action));
end; $$;

-- Delivery is bounded and idempotent. Scheduling eligibility also applies when
-- the worker is delayed; no future or expired notice is delivered.
create table public.control_document_deliveries(document_id uuid references public.control_documents(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,version integer,created_at timestamptz not null default now(),primary key(document_id,user_id));
alter table public.control_document_deliveries enable row level security;
revoke all on public.control_document_deliveries from public,anon,authenticated;
grant all on public.control_document_deliveries to service_role;
create function public.deliver_control_announcements(p_limit integer default 50) returns integer language plpgsql security definer set search_path='' as $$
declare delivery record; count integer:=0;
begin
  if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted scheduler required.' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'Invalid delivery batch.' using errcode='23514'; end if;
  for delivery in select d.id document_id,d.version,d.title,d.body,d.content,p.id user_id from public.control_documents d cross join public.profiles p
    where d.kind='announcement' and d.status='published' and d.content->>'notification'='true' and (d.starts_at is null or d.starts_at<=now()) and (d.expires_at is null or d.expires_at>now())
    and p.status='active' and (d.audience in ('public','members') or exists(select 1 from public.admin_roles where user_id=p.id and suspended_at is null))
    and (d.content->>'type'='important' or exists(select 1 from public.notification_preferences where user_id=p.id and enabled))
    and not exists(select 1 from public.control_document_deliveries where document_id=d.id and user_id=p.id)
    order by d.created_at,p.id limit p_limit loop
    insert into public.control_document_deliveries values(delivery.document_id,delivery.user_id,delivery.version,now()) on conflict do nothing;
    insert into public.control_notifications(recipient_id,subject,body,href,event_key,essential)
    values(delivery.user_id,delivery.title,left(delivery.body,3000),'/announcements','announcement:'||delivery.document_id,delivery.content->>'type'='important') on conflict do nothing;
    count:=count+1;
  end loop;
  return count;
end; $$;

do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['control_add_user_note','control_restore_account','control_rate_limit','resolve_control_appeal','control_bulk_category','retry_catalog_failures','control_import_audit','control_member_export','control_request_deletion','deliver_control_announcements']) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
end loop; end; $$;
grant execute on function public.control_add_user_note(uuid,text),public.control_restore_account(uuid,text),public.resolve_control_appeal(uuid,text,text,timestamptz),public.control_bulk_category(uuid[],public.entertainment_kind,text),public.retry_catalog_failures(uuid,text),public.control_import_audit(uuid,text),public.control_member_export(),public.control_request_deletion() to authenticated;
grant execute on function public.deliver_control_announcements(integer) to service_role;

$migration_202611250030$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250030' then raise exception 'Migration 202611250030 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250030','control_completion',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  -- 202611250031_catalog_batch_integrity.sql; SHA256 5c5c48d1143e41df2f9af0ae8ef53e50cf343b05eac5b0b92707a3e463c8c20a
  if not '202611250031' = any(v_history) then
    execute $migration_202611250031$
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

$migration_202611250031$;
    execute v_schema_sql into v_actual;
    if v_actual is distinct from v_expected->>'202611250031' then raise exception 'Migration 202611250031 produced an unexpected schema. The statement is rolled back.'; end if;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('202611250031','catalog_batch_integrity',array[]::text[]);
    v_applied := v_applied+1;
  end if;

  execute v_snapshot_sql into v_after;
  if v_after is distinct from v_before then raise exception 'Existing user/catalog/library data changed unexpectedly. The entire upgrade is rolled back.'; end if;
  if (select count(*) from public.admin_roles where role='super_admin')<>1 or not exists(select 1 from app_private.platform_owner o join public.profiles p on p.id=o.user_id join public.admin_roles a on a.user_id=o.user_id and a.role='super_admin' where o.user_id='973543d2-96d9-498b-b9b4-3adf237bd507'::uuid and p.status='active' and a.suspended_at is null) then raise exception 'Owner preservation check failed. The entire statement is rolled back.'; end if;
  if (select count(*) from public.admin_roles where role='moderator')+(select count(*) from public.admin_invitations where status='pending' and expires_at>now())>5 then raise exception 'Moderator capacity invariant failed.'; end if;
  execute v_schema_sql into v_actual;
  if v_actual is distinct from v_expected->>'202611250031' then raise exception 'Final schema/RLS/grant verification failed. The entire statement is rolled back.'; end if;
  perform pg_notify('pgrst','reload schema');
  raise notice 'Control Center verified: % migrations applied atomically; original owner and data fingerprints preserved.',v_applied;
end;
$scenestack_control_upgrade$;
