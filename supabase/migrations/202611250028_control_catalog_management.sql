begin;
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
commit;
