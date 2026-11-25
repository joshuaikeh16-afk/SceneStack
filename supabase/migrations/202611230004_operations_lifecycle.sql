begin;
create function public.bootstrap_platform_owner(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.active(p_user) or exists(select 1 from app_private.platform_owner) then raise exception 'Owner bootstrap unavailable.' using errcode='42501'; end if;
  insert into app_private.platform_owner(user_id) values(p_user);
  insert into public.admin_roles(user_id,role,granted_by) values(p_user,'super_admin',p_user);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(p_user,'owner_bootstrap','profile',p_user);
end; $$;
create function public.manage_admin_role(p_actor uuid,p_user uuid,p_role public.admin_role,p_grant boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.active(p_actor) or not exists(select 1 from app_private.platform_owner where user_id=p_actor) or not app_private.active(p_user) then raise exception 'Role operation unavailable.' using errcode='42501'; end if;
  if p_user=p_actor and p_role='super_admin' and not p_grant then raise exception 'Transfer platform ownership first.' using errcode='42501'; end if;
  if p_grant then insert into public.admin_roles(user_id,role,granted_by) values(p_user,p_role,p_actor) on conflict(user_id,role) do nothing;
  else delete from public.admin_roles where user_id=p_user and role=p_role; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(p_actor,case when p_grant then 'role_granted' else 'role_revoked' end,'profile',p_user,p_role::text);
end; $$;
create function public.transfer_platform_owner(p_actor uuid,p_next uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from app_private.platform_owner where user_id=p_actor for update;
  if not found or not app_private.active(p_actor) or not app_private.active(p_next) then raise exception 'Owner operation unavailable.' using errcode='42501'; end if;
  update app_private.platform_owner set user_id=p_next;
  insert into public.admin_roles(user_id,role,granted_by) values(p_next,'super_admin',p_actor) on conflict do nothing;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(p_actor,'ownership_transferred','profile',p_next);
end; $$;
create function public.submit_report(p_user uuid,p_collection uuid,p_reason text,p_details text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('report',10,interval '1 hour');
  if (p_user is null)=(p_collection is null) or p_user=who then raise exception 'Invalid report target.' using errcode='23514'; end if;
  if p_user is not null and not app_private.can_interact(p_user) then raise exception 'Target unavailable.' using errcode='42501'; end if;
  if p_collection is not null and not exists(select 1 from public.collections where id=p_collection and visibility='published' and app_private.can_read_collection(id)) then raise exception 'Target unavailable.' using errcode='42501'; end if;
  insert into public.reports(reporter_id,target_user_id,collection_id,reason,details) values(who,p_user,p_collection,p_reason,p_details) returning id into result;
  return result;
end; $$;
create function public.submit_missing_title(p_title text,p_kind public.entertainment_kind,p_details text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('missing_title',10,interval '1 day');
  insert into public.missing_title_requests(user_id,title,kind,details) values(who,p_title,p_kind,p_details) returning id into result; return result;
end; $$;
create function public.suggest_correction(p_title uuid,p_field text,p_value text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('correction',20,interval '1 day');
  insert into public.metadata_corrections(user_id,title_id,field_name,proposed_value,reason) values(who,p_title,p_field,p_value,p_reason) returning id into result; return result;
end; $$;
create function public.propose_catalog_merge(p_source uuid,p_target uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('catalog_editor') then raise exception 'Catalog operation unavailable.' using errcode='42501'; end if;
  insert into public.catalog_merge_requests(source_id,target_id,requested_by,reason) values(p_source,p_target,auth.uid(),p_reason) returning id into result;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'merge_proposed','title',p_source); return result;
end; $$;
create function public.resolve_title(p_title uuid) returns uuid language sql stable set search_path='' as $$
  with recursive chain(id,depth,path) as (
    select id,0,array[id] from public.titles where id=p_title
    union all select r.target_id,c.depth+1,c.path||r.target_id from chain c join public.title_redirects r on r.source_id=c.id where c.depth<64 and not r.target_id=any(c.path)
  ) select id from chain order by depth desc limit 1;
$$;
create function public.catalog_edit_title(p_id uuid,p_name text,p_kind public.entertainment_kind,p_description text default '',p_year integer default null,p_original text default null,p_age text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('catalog_editor') then raise exception 'Catalog operation unavailable.' using errcode='42501'; end if;
  if p_id is null then insert into public.titles(display_title,kind,description,release_year,original_title,age_rating) values(p_name,p_kind,p_description,p_year,p_original,p_age) returning id into result;
  else update public.titles set display_title=p_name,kind=p_kind,description=p_description,release_year=p_year,original_title=p_original,age_rating=p_age where id=p_id returning id into result;
    if result is null then raise exception 'Title unavailable.' using errcode='42501'; end if;
  end if;
  return result;
end; $$;
create function public.review_catalog_submission(p_kind text,p_id uuid,p_approve boolean,p_notes text default '',p_resolved_title uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare correction public.metadata_corrections; merging public.catalog_merge_requests; target uuid;
begin
  if not app_private.has_role('catalog_editor') then raise exception 'Review unavailable.' using errcode='42501'; end if;
  if char_length(p_notes)>3000 then raise exception 'Review note too long.' using errcode='23514'; end if;
  if p_kind='missing' then
    perform 1 from public.missing_title_requests where id=p_id and status='pending' for update;
    if not found then raise exception 'Submission unavailable.' using errcode='42501'; end if;
    if p_approve and p_resolved_title is null then raise exception 'An approved request requires a canonical title.' using errcode='23514'; end if;
    update public.missing_title_requests set status=case when p_approve then 'approved'::public.review_status else 'rejected'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_notes,resolved_title_id=p_resolved_title where id=p_id;
  elsif p_kind='correction' then
    select * into correction from public.metadata_corrections where id=p_id and status='pending' for update;
    if not found then raise exception 'Submission unavailable.' using errcode='42501'; end if;
    if p_approve then
      case correction.field_name
        when 'display_title' then update public.titles set display_title=correction.proposed_value where id=correction.title_id;
        when 'original_title' then update public.titles set original_title=correction.proposed_value where id=correction.title_id;
        when 'description' then update public.titles set description=correction.proposed_value where id=correction.title_id;
        when 'release_year' then
          if correction.proposed_value !~ '^[0-9]{4}$' then raise exception 'Invalid year.' using errcode='23514'; end if;
          update public.titles set release_year=correction.proposed_value::integer where id=correction.title_id;
        when 'kind' then update public.titles set kind=correction.proposed_value::public.entertainment_kind where id=correction.title_id;
        when 'age_rating' then update public.titles set age_rating=correction.proposed_value where id=correction.title_id;
        else raise exception 'Unsupported correction.' using errcode='23514';
      end case;
    end if;
    update public.metadata_corrections set status=case when p_approve then 'approved'::public.review_status else 'rejected'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_notes where id=p_id;
  elsif p_kind='merge' then
    select * into merging from public.catalog_merge_requests where id=p_id and status='pending' for update;
    if not found then raise exception 'Submission unavailable.' using errcode='42501'; end if;
    if p_approve then
      perform id from public.titles where id in (merging.source_id,merging.target_id) order by id for update;
      target:=public.resolve_title(merging.target_id);
      if target is null or target=merging.source_id or exists(select 1 from public.title_redirects where source_id=merging.source_id) then raise exception 'Invalid merge.' using errcode='23514'; end if;
      insert into public.title_redirects(source_id,target_id) values(merging.source_id,target);
      update public.title_redirects set target_id=target where target_id=merging.source_id;
      update public.titles set status='merged' where id=merging.source_id;
      -- Existing references are retained; canonical redirects resolve them without deleting user data.
    end if;
    update public.catalog_merge_requests set status=case when p_approve then 'approved'::public.review_status else 'rejected'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_notes where id=p_id;
  else raise exception 'Unsupported submission.' using errcode='23514'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'catalog_review',p_kind,p_id,case when p_approve then 'approved' else 'rejected' end);
end; $$;
create function public.moderate_report(p_report uuid,p_action public.moderation_kind,p_reason text,p_until timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; target uuid;
begin
  if not app_private.has_role('moderator') or (p_action='ban' and not app_private.has_role('super_admin')) then raise exception 'Moderation unavailable.' using errcode='42501'; end if;
  select * into r from public.reports where id=p_report and status='pending' for update;
  if not found then raise exception 'Report unavailable.' using errcode='42501'; end if;
  target:=coalesce(r.target_user_id,(select owner_id from public.collections where id=r.collection_id));
  if p_action in ('ban','suspension') then
    if target is null or exists(select 1 from app_private.platform_owner where user_id=target) or (not app_private.has_role('super_admin') and exists(select 1 from public.admin_roles where user_id=target)) then raise exception 'Moderation target unavailable.' using errcode='42501'; end if;
    if p_action='suspension' and (p_until is null or p_until<=now() or p_until>now()+interval '365 days') then raise exception 'Invalid suspension period.' using errcode='23514'; end if;
    update public.profiles set status=case when p_action='ban' then 'banned'::public.account_status else 'suspended'::public.account_status end where id=target and status<>'purging';
  elsif p_action='content_removal' then
    if r.collection_id is null then raise exception 'A collection is required.' using errcode='23514'; end if;
    update public.collections set removed_at=now() where id=r.collection_id;
  end if;
  insert into public.moderation_actions(report_id,actor_id,target_user_id,collection_id,action,reason,expires_at) values(r.id,auth.uid(),target,r.collection_id,p_action,p_reason,case when p_action='suspension' then p_until else null end);
  update public.reports set status=case when p_action='dismissal' then 'rejected'::public.review_status else 'approved'::public.review_status end,reviewer_id=auth.uid(),reviewed_at=now(),reviewer_notes=p_reason where id=r.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'moderation','report',r.id,p_action::text);
end; $$;
create function app_private.profile_status_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status then
    if new.status<>'active' then delete from public.follows where follower_id=new.id or followed_id=new.id; end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'account_status','profile',new.id,new.status::text);
  end if;
  return new;
end; $$;
create trigger profile_status_event after update of status on public.profiles for each row execute function app_private.profile_status_event();
create function app_private.audit_catalog_change() returns trigger language plpgsql security definer set search_path='' as $$
declare value jsonb; entity uuid;
begin
  if tg_op='DELETE' then value:=to_jsonb(old); else value:=to_jsonb(new); end if;
  entity:=coalesce(value->>'id',value->>'title_id',value->>'source_id')::uuid;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'catalog_'||lower(tg_op),tg_table_name,entity,'Catalog metadata changed');
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
do $$ declare t text; begin foreach t in array array['titles','provider_title_ids','title_names','genres','title_genres','title_artwork','title_trailers','content_warnings','title_content_warnings','people','title_credits','title_relations','title_redirects','metadata_provenance','metadata_providers'] loop
  execute format('create trigger audit_catalog after insert or update or delete on public.%I for each row execute function app_private.audit_catalog_change()',t);
end loop; end; $$;
create function public.request_metadata_refresh(p_title uuid,p_provider uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not app_private.has_role('catalog_editor') or not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled) then raise exception 'Refresh unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('refresh',100,interval '1 hour');
  insert into public.metadata_refresh_requests(title_id,provider_id,requested_by) values(p_title,p_provider,auth.uid()) on conflict(title_id,provider_id) where state in ('pending','running') do update set title_id=excluded.title_id returning id into result;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'refresh_requested','title',p_title); return result;
end; $$;
create function public.record_provider_sync(p_title uuid,p_provider uuid,p_success boolean,p_error_code text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled) then raise exception 'Provider unavailable.' using errcode='42501'; end if;
  if p_error_code is not null and p_error_code not in ('timeout','rate_limited','unavailable','invalid_payload','not_found') then raise exception 'Unsupported provider status.' using errcode='23514'; end if;
  insert into public.provider_sync_state(title_id,provider_id,last_success_at,next_attempt_at,attempts,state,last_error_code,last_error)
    values(p_title,p_provider,case when p_success then now() else null end,now()+case when p_success then interval '7 days' else interval '5 minutes' end,case when p_success then 0 else 1 end,case when p_success then 'ready' else 'failed' end,case when p_success then null else p_error_code end,case when p_success then null else 'Metadata refresh failed; cached catalog retained.' end)
    on conflict(title_id,provider_id) do update set last_success_at=case when p_success then now() else public.provider_sync_state.last_success_at end,
      next_attempt_at=now()+case when p_success then interval '7 days' else least(interval '24 hours',interval '5 minutes'*power(2,least(public.provider_sync_state.attempts,8))) end,
      attempts=case when p_success then 0 else public.provider_sync_state.attempts+1 end,state=case when p_success then 'ready' else 'failed' end,
      last_error_code=case when p_success then null else p_error_code end,last_error=case when p_success then null else 'Metadata refresh failed; cached catalog retained.' end;
  if not p_success then insert into public.admin_alerts(provider_id,title_id,code,message) values(p_provider,p_title,coalesce(p_error_code,'unavailable'),'Metadata refresh failed; cached catalog retained.'); end if;
  update public.metadata_refresh_requests set state=case when p_success then 'completed' else 'failed' end,finished_at=now() where title_id=p_title and provider_id=p_provider and state in ('pending','running');
end; $$;
create function public.request_account_deletion() returns timestamptz language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); deadline timestamptz;
begin
  perform 1 from public.profiles where id=who for update;
  if exists(select 1 from app_private.platform_owner where user_id=who) then raise exception 'Transfer platform ownership before requesting deletion.' using errcode='42501'; end if;
  insert into public.account_deletions(user_id) values(who) returning recover_until into deadline;
  update public.profiles set status='deletion_pending' where id=who;
  return deadline;
end; $$;
create function public.recover_account() returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); deletion public.account_deletions; fresh boolean;
begin
  perform 1 from public.profiles where id=who and status='deletion_pending' for update;
  if not found then raise exception 'Recovery unavailable.' using errcode='42501'; end if;
  select * into deletion from public.account_deletions where user_id=who for update;
  if not found or deletion.claimed_at is not null or now()>=deletion.recover_until then raise exception 'Recovery unavailable.' using errcode='42501'; end if;
  -- AMR timestamp survives token refresh; JWT iat alone does not prove reauthentication.
  if jsonb_typeof(auth.jwt()->'amr')<>'array' then raise exception 'Please sign in with Google again.' using errcode='42501'; end if;
  select exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'='oauth' and (a->>'timestamp')~'^[0-9]{1,11}$' and to_timestamp((a->>'timestamp')::double precision)>=greatest(deletion.requested_at,now()-interval '5 minutes') and to_timestamp((a->>'timestamp')::double precision)<=now()+interval '30 seconds') into fresh;
  if not fresh then raise exception 'Please sign in with Google again.' using errcode='42501'; end if;
  delete from public.account_deletions where user_id=who;
  update public.profiles set status='active' where id=who;
end; $$;
create function public.claim_account_purge(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare deletion public.account_deletions;
begin
  perform 1 from public.profiles where id=p_user and status<>'active' for update;
  if not found or exists(select 1 from app_private.platform_owner where user_id=p_user) then return false; end if;
  select * into deletion from public.account_deletions where user_id=p_user for update;
  if not found or now()<deletion.recover_until then return false; end if;
  update public.account_deletions set claimed_at=coalesce(claimed_at,now()) where user_id=p_user;
  update public.profiles set status='purging' where id=p_user;
  insert into public.audit_logs(action,entity_type,entity_id) values('purge_claimed','profile',p_user);
  return true;
end; $$;
create function public.release_expired_suspensions() returns integer language plpgsql security definer set search_path='' as $$
declare result integer;
begin
  update public.profiles p set status=case when exists(select 1 from public.account_deletions d where d.user_id=p.id) then 'deletion_pending'::public.account_status else 'active'::public.account_status end
    where p.status='suspended' and exists(select 1 from public.moderation_actions a where a.target_user_id=p.id and a.action='suspension' and a.expires_at<=now() and not exists(select 1 from public.moderation_actions later where later.target_user_id=p.id and later.action in ('ban','suspension') and later.created_at>a.created_at));
  get diagnostics result=row_count; return result;
end; $$;
create function public.request_data_export(p_format text) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('export',2,interval '1 hour');
  insert into public.data_export_requests(user_id,format) values(who,p_format) returning id into result; return result;
end; $$;
create function public.export_personal_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result jsonb; t text; payload jsonb;
begin
  perform app_private.rate_limit('export_download',2,interval '1 hour');
  result:=jsonb_build_object('exported_at',now(),'profile',(select to_jsonb(p) from public.profiles p where p.id=who));
  foreach t in array array['onboarding','notification_preferences','recommendation_preferences','preferred_categories','favorite_genres','preferred_languages','tracking','tracking_history','ratings','rating_history','favorites','collection_imports','data_export_requests'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where user_id=$1',t) into payload using who;
    result:=result||jsonb_build_object(t,payload);
  end loop;
  result:=result||jsonb_build_object(
    'collections',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.collections c where owner_id=who),
    'collection_items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.collection_items i join public.collections c on c.id=i.collection_id where c.owner_id=who),
    'collection_saves',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_saves s where user_id=who and app_private.can_read_collection(collection_id)),
    'collection_favorites',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.collection_favorites s where user_id=who and app_private.can_read_collection(collection_id)),
    'follows',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.follows f where follower_id=who),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.blocks b where blocker_id=who),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.notifications n where recipient_id=who and app_private.can_interact(actor_id) and (collection_id is null or app_private.can_read_collection(collection_id))),
    'reports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'details',details,'status',status,'created_at',created_at)),'[]') from public.reports where reporter_id=who));
  return result;
end; $$;
grant select on public.account_deletions to authenticated;
create policy deletion_owner_read on public.account_deletions for select to authenticated using(user_id=auth.uid());

-- No browser can bootstrap ownership, grant roles, complete a sync, or claim purges.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['bootstrap_platform_owner','manage_admin_role','transfer_platform_owner','submit_report','submit_missing_title','suggest_correction','propose_catalog_merge','resolve_title','catalog_edit_title','review_catalog_submission','moderate_report','profile_status_event','audit_catalog_change','request_metadata_refresh','record_provider_sync','request_account_deletion','recover_account','claim_account_purge','release_expired_suspensions','request_data_export','export_personal_data']) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
end loop; end; $$;
grant execute on function public.bootstrap_platform_owner(uuid),public.manage_admin_role(uuid,uuid,public.admin_role,boolean),public.transfer_platform_owner(uuid,uuid),public.record_provider_sync(uuid,uuid,boolean,text),public.claim_account_purge(uuid),public.release_expired_suspensions() to service_role;
grant execute on function public.submit_report(uuid,uuid,text,text),public.submit_missing_title(text,public.entertainment_kind,text),public.suggest_correction(uuid,text,text,text),public.propose_catalog_merge(uuid,uuid,text),public.catalog_edit_title(uuid,text,public.entertainment_kind,text,integer,text,text),public.review_catalog_submission(text,uuid,boolean,text,uuid),public.moderate_report(uuid,public.moderation_kind,text,timestamptz),public.request_metadata_refresh(uuid,uuid),public.request_account_deletion(),public.recover_account(),public.request_data_export(text),public.export_personal_data() to authenticated;
grant execute on function public.resolve_title(uuid) to anon,authenticated;
commit;
