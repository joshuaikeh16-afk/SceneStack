begin;
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
commit;
