begin;

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
commit;
