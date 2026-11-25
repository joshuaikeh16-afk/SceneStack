begin;
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
commit;
