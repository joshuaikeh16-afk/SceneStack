begin;
create function app_private.lock_user_pair(p_a uuid,p_b uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform id from public.profiles where id in (p_a,p_b) order by id for update; end; $$;
create function app_private.guard_collection() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.owner_id<>old.owner_id) then raise exception 'Collection ownership is permanent.' using errcode='23514'; end if;
  if new.cover_path is not null and new.cover_path !~ ('^'||new.owner_id::text||'/'||new.id::text||'/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid cover reference.' using errcode='23514'; end if;
  if new.collage_reference is not null and new.collage_reference !~ ('^'||new.owner_id::text||'/'||new.id::text||'/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$') then raise exception 'Invalid collage reference.' using errcode='23514'; end if;
  return new;
end; $$;
create trigger collection_guard before insert or update on public.collections for each row execute function app_private.guard_collection();
create function app_private.emit_notification(p_recipient uuid,p_actor uuid,p_kind public.notification_kind,p_collection uuid,p_key text) returns void language plpgsql security definer set search_path='' as $$
declare pref public.notification_preferences;
begin
  if p_recipient=p_actor or not app_private.active(p_recipient) or not app_private.active(p_actor) or app_private.blocked(p_recipient,p_actor) then return; end if;
  select * into pref from public.notification_preferences where user_id=p_recipient;
  if not found or not pref.enabled or (p_kind='new_follower' and not pref.new_followers) or (p_kind='collection_favorite' and not pref.collection_favorites) or (p_kind='collection_published' and not pref.followed_collections) then return; end if;
  insert into public.notifications(recipient_id,actor_id,kind,collection_id,dedupe_key) values(p_recipient,p_actor,p_kind,p_collection,p_key) on conflict(recipient_id,dedupe_key) do nothing;
end; $$;
create function app_private.collection_visibility_event() returns trigger language plpgsql security definer set search_path='' as $$
declare f record;
begin
  if tg_op='UPDATE' and ((old.visibility='published' and new.visibility='private') or new.removed_at is not null) then
    delete from public.collection_saves where collection_id=new.id;
    delete from public.collection_favorites where collection_id=new.id;
  end if;
  if new.visibility='published' and new.removed_at is null and (tg_op='INSERT' or old.visibility='private') then
    for f in select follower_id from public.follows where followed_id=new.owner_id loop
      perform app_private.emit_notification(f.follower_id,new.owner_id,'collection_published',new.id,'published:'||new.id::text);
    end loop;
  end if;
  return new;
end; $$;
create trigger collection_visibility_event after insert or update of visibility,removed_at on public.collections for each row execute function app_private.collection_visibility_event();
create function app_private.guard_collection_interaction() returns trigger language plpgsql security definer set search_path='' as $$
declare source public.collections;
begin
  perform app_private.require_member();
  select * into source from public.collections where id=new.collection_id for share;
  if not found then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  perform app_private.lock_user_pair(auth.uid(),source.owner_id);
  if new.user_id<>auth.uid() or source.visibility<>'published' or source.removed_at is not null or not app_private.can_interact(source.owner_id) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('collection_interaction',300,interval '1 hour');
  return new;
end; $$;
create trigger collection_favorite_guard before insert on public.collection_favorites for each row execute function app_private.guard_collection_interaction();
create trigger collection_save_guard before insert on public.collection_saves for each row execute function app_private.guard_collection_interaction();
create function app_private.collection_favorite_event() returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  select owner_id into owner from public.collections where id=new.collection_id;
  perform app_private.emit_notification(owner,new.user_id,'collection_favorite',new.collection_id,'favorite:'||new.user_id::text||':'||new.collection_id::text);
  return new;
end; $$;
create trigger collection_favorite_event after insert on public.collection_favorites for each row execute function app_private.collection_favorite_event();
create function public.add_collection_item(p_collection uuid,p_title uuid,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; pos bigint;
begin
  perform app_private.require_member();
  perform 1 from public.collections where id=p_collection for update;
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  select coalesce(max(position),-1)+1 into pos from public.collection_items where collection_id=p_collection;
  insert into public.collection_items(collection_id,title_id,position,creator_note) values(p_collection,p_title,pos,p_note) returning id into result;
  update public.collections set updated_at=now() where id=p_collection;
  return result;
end; $$;
create function public.reorder_collection_items(p_collection uuid,p_item_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
  perform app_private.require_member();
  perform 1 from public.collections where id=p_collection for update;
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  select count(*) into n from public.collection_items where collection_id=p_collection;
  if p_item_ids is null or n<>cardinality(p_item_ids) or n<>(select count(distinct x) from unnest(p_item_ids) x) or exists(select 1 from unnest(p_item_ids) x where not exists(select 1 from public.collection_items where id=x and collection_id=p_collection)) then raise exception 'Ordering must contain every item exactly once.' using errcode='23514'; end if;
  set constraints public.collection_item_position_key deferred;
  update public.collection_items i set position=q.pos-1 from unnest(p_item_ids) with ordinality q(id,pos) where i.id=q.id and i.collection_id=p_collection;
  set constraints public.collection_item_position_key immediate;
  update public.collections set updated_at=now() where id=p_collection;
end; $$;
create function public.import_collection(p_source uuid,p_title text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); source public.collections; result uuid;
begin
  perform app_private.rate_limit('imports',20,interval '1 hour');
  select * into source from public.collections where id=p_source for share;
  if not found then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  perform app_private.lock_user_pair(who,source.owner_id);
  if source.visibility<>'published' or not app_private.can_read_collection(source.id) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  insert into public.collections(owner_id,title,description,visibility,spoiler_warning,sort_by,sort_desc)
    values(who,coalesce(p_title,source.title),source.description,'private',source.spoiler_warning,source.sort_by,source.sort_desc) returning id into result;
  -- Never copy private Storage paths: imported content is independent, not a URL into another owner’s bucket.
  insert into public.collection_items(collection_id,title_id,position,creator_note) select result,title_id,position,creator_note from public.collection_items where collection_id=p_source order by position,id;
  insert into public.collection_imports(user_id,imported_collection_id,source_collection_id,source_owner_id) values(who,result,p_source,source.owner_id);
  return result;
end; $$;
create function public.collection_metrics(p_collection uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.owns_collection(p_collection) then raise exception 'Collection unavailable.' using errcode='42501'; end if;
  return jsonb_build_object('favorites',(select count(*) from public.collection_favorites where collection_id=p_collection),'saves',(select count(*) from public.collection_saves where collection_id=p_collection),'imports',(select count(*) from public.collection_imports where source_collection_id=p_collection));
end; $$;
create function app_private.guard_follow() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_member(); perform app_private.lock_user_pair(new.follower_id,new.followed_id);
  if new.follower_id<>auth.uid() or not app_private.can_interact(new.followed_id) then raise exception 'Interaction unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('follow',100,interval '1 hour'); return new;
end; $$;
create trigger follow_guard before insert on public.follows for each row execute function app_private.guard_follow();
create function app_private.follow_event() returns trigger language plpgsql security definer set search_path='' as $$
begin perform app_private.emit_notification(new.followed_id,new.follower_id,'new_follower',null,'follow:'||new.follower_id::text); return new; end; $$;
create trigger follow_event after insert on public.follows for each row execute function app_private.follow_event();
create function app_private.block_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_member(); perform app_private.lock_user_pair(new.blocker_id,new.blocked_id);
  if new.blocker_id<>auth.uid() then raise exception 'Interaction unavailable.' using errcode='42501'; end if;
  perform app_private.rate_limit('block',100,interval '1 hour');
  delete from public.follows where (follower_id=new.blocker_id and followed_id=new.blocked_id) or (follower_id=new.blocked_id and followed_id=new.blocker_id);
  delete from public.collection_saves s using public.collections c where s.collection_id=c.id and ((s.user_id=new.blocker_id and c.owner_id=new.blocked_id) or (s.user_id=new.blocked_id and c.owner_id=new.blocker_id));
  delete from public.collection_favorites f using public.collections c where f.collection_id=c.id and ((f.user_id=new.blocker_id and c.owner_id=new.blocked_id) or (f.user_id=new.blocked_id and c.owner_id=new.blocker_id));
  delete from public.notifications where (actor_id=new.blocker_id and recipient_id=new.blocked_id) or (actor_id=new.blocked_id and recipient_id=new.blocker_id);
  return new;
end; $$;
create trigger block_event after insert on public.blocks for each row execute function app_private.block_event();
create function public.follow_counts(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.can_interact(p_user) then raise exception 'Profile unavailable.' using errcode='42501'; end if;
  return jsonb_build_object('followers',(select count(*) from public.follows where followed_id=p_user and app_private.can_interact(follower_id)),'following',(select count(*) from public.follows where follower_id=p_user and app_private.can_interact(followed_id)));
end; $$;

-- Parent helpers are security-definer and avoid recursive collection/item policies.
grant select on public.collections,public.collection_items to authenticated;
grant insert(title,description,visibility,spoiler_warning,cover_path,collage_reference,sort_by,sort_desc) on public.collections to authenticated;
grant update(title,description,visibility,spoiler_warning,cover_path,collage_reference,sort_by,sort_desc) on public.collections to authenticated;
grant delete on public.collections,public.collection_items to authenticated;
grant update(creator_note) on public.collection_items to authenticated;
create policy collection_read on public.collections for select to authenticated using(removed_at is null and app_private.member() and (owner_id=auth.uid() or (visibility='published' and app_private.can_interact(owner_id))));
create policy collection_create on public.collections for insert to authenticated with check(owner_id=auth.uid() and app_private.member() and removed_at is null);
create policy collection_edit on public.collections for update to authenticated using(app_private.owns_collection(id)) with check(owner_id=auth.uid() and app_private.member());
create policy collection_delete on public.collections for delete to authenticated using(app_private.owns_collection(id));
create policy item_read on public.collection_items for select to authenticated using(app_private.can_read_collection(collection_id));
create policy item_edit on public.collection_items for update to authenticated using(app_private.owns_collection(collection_id)) with check(app_private.owns_collection(collection_id));
create policy item_delete on public.collection_items for delete to authenticated using(app_private.owns_collection(collection_id));
do $$ declare t text; begin
  foreach t in array array['collection_favorites','collection_saves'] loop
    execute format('grant select,delete on public.%I to authenticated',t);
    execute format('grant insert(collection_id) on public.%I to authenticated',t);
    execute format('create policy interaction_read on public.%I for select to authenticated using(user_id=auth.uid() and app_private.can_read_collection(collection_id))',t);
    execute format('create policy interaction_insert on public.%I for insert to authenticated with check(user_id=auth.uid() and app_private.can_read_collection(collection_id))',t);
    execute format('create policy interaction_delete on public.%I for delete to authenticated using(user_id=auth.uid() and app_private.member())',t);
  end loop;
end; $$;
grant select,delete on public.follows,public.blocks to authenticated;
grant insert(followed_id) on public.follows to authenticated;
grant insert(blocked_id) on public.blocks to authenticated;
create policy follow_read on public.follows for select to authenticated using((follower_id=auth.uid() or followed_id=auth.uid()) and app_private.can_interact(follower_id) and app_private.can_interact(followed_id));
create policy follow_insert on public.follows for insert to authenticated with check(follower_id=auth.uid() and app_private.can_interact(followed_id));
create policy follow_delete on public.follows for delete to authenticated using(follower_id=auth.uid() and app_private.member());
create policy block_read on public.blocks for select to authenticated using(blocker_id=auth.uid() and app_private.member());
create policy block_insert on public.blocks for insert to authenticated with check(blocker_id=auth.uid() and app_private.member());
create policy block_delete on public.blocks for delete to authenticated using(blocker_id=auth.uid() and app_private.member());
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy notification_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and app_private.member() and app_private.can_interact(actor_id) and (collection_id is null or app_private.can_read_collection(collection_id)));
create policy notification_update on public.notifications for update to authenticated using(recipient_id=auth.uid() and app_private.member()) with check(recipient_id=auth.uid() and app_private.member());
grant select on public.admin_roles,public.reports,public.moderation_actions,public.audit_logs,public.missing_title_requests,public.metadata_corrections,public.catalog_merge_requests,public.provider_sync_state,public.metadata_refresh_requests,public.admin_alerts to authenticated;
create policy roles_self_read on public.admin_roles for select to authenticated using(user_id=auth.uid() and app_private.member());
create policy reports_read on public.reports for select to authenticated using(app_private.member() and (reporter_id=auth.uid() or app_private.has_role('moderator')));
create policy actions_read on public.moderation_actions for select to authenticated using((target_user_id=auth.uid() and app_private.member()) or app_private.has_role('moderator'));
create policy audit_read on public.audit_logs for select to authenticated using(app_private.has_role('super_admin'));
create policy missing_read on public.missing_title_requests for select to authenticated using(app_private.member() and (user_id=auth.uid() or app_private.has_role('catalog_editor')));
create policy correction_read on public.metadata_corrections for select to authenticated using(app_private.member() and (user_id=auth.uid() or app_private.has_role('catalog_editor')));
create policy merge_read on public.catalog_merge_requests for select to authenticated using(app_private.member() and (requested_by=auth.uid() or app_private.has_role('catalog_editor')));
do $$ declare t text; begin foreach t in array array['provider_sync_state','metadata_refresh_requests','admin_alerts'] loop
  execute format('create policy catalog_operations_read on public.%I for select to authenticated using(app_private.has_role(''catalog_editor''))',t);
end loop; end; $$;

-- Close implicit EXECUTE on every function created in this migration.
do $$ declare f record; begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname=any(array['lock_user_pair','guard_collection','emit_notification','collection_visibility_event','guard_collection_interaction','collection_favorite_event','add_collection_item','reorder_collection_items','import_collection','collection_metrics','guard_follow','follow_event','block_event','follow_counts']) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
end loop; end; $$;
grant execute on function public.add_collection_item(uuid,uuid,text),public.reorder_collection_items(uuid,uuid[]),public.import_collection(uuid,text),public.collection_metrics(uuid),public.follow_counts(uuid) to authenticated;
commit;
