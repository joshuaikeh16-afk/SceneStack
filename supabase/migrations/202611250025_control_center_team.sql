begin;

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
commit;
