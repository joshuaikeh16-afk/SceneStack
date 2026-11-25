begin;

create function app_private.active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=p_id and status='active');
$$;
create function app_private.member() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and app_private.active(auth.uid()); $$;
create function app_private.blocked(p_a uuid,p_b uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.blocks where (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a));
$$;
create function app_private.can_interact(p_target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and app_private.active(p_target) and not app_private.blocked(auth.uid(),p_target);
$$;
create function app_private.can_read_collection(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.collections c where c.id=p_id and c.removed_at is null and
    app_private.can_interact(c.owner_id) and (c.owner_id=auth.uid() or c.visibility='published'));
$$;
create function app_private.owns_collection(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.collections where id=p_id and owner_id=auth.uid() and removed_at is null);
$$;
create function app_private.has_role(p_role public.admin_role) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.admin_roles where user_id=auth.uid() and (role=p_role or role='super_admin'));
$$;
create function app_private.require_member() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501'; end if;
  return auth.uid();
end; $$;
create function app_private.rate_limit(p_bucket text,p_max integer,p_window interval) returns void language plpgsql security definer set search_path='' as $$
declare n integer; ts timestamptz; who uuid:=auth.uid();
begin
  if who is null or not app_private.member() then raise exception 'Access unavailable.' using errcode='42501'; end if;
  ts:=to_timestamp(floor(extract(epoch from clock_timestamp())/extract(epoch from p_window))*extract(epoch from p_window));
  insert into app_private.rate_limits(user_id,bucket,window_start,count) values(who,p_bucket,ts,1)
  on conflict(user_id,bucket,window_start) do update set count=app_private.rate_limits.count+1 returning count into n;
  if n>p_max then raise exception 'Please try again later.' using errcode='P0001'; end if;
end; $$;
create function app_private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end; $$;
create function app_private.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'SceneStack member'),80));
  insert into public.onboarding(user_id) values(new.id);
  insert into public.notification_preferences(user_id) values(new.id);
  insert into public.recommendation_preferences(user_id) values(new.id);
  return new;
end; $$;
create trigger scenestack_initialize_profile after insert on auth.users for each row execute function app_private.initialize_profile();
-- Existing accounts are backfilled without copying emails or trusting role metadata.
insert into public.profiles(id,display_name) select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'),''),'SceneStack member'),80) from auth.users on conflict(id) do nothing;
insert into public.onboarding(user_id) select id from public.profiles on conflict do nothing;
insert into public.notification_preferences(user_id) select id from public.profiles on conflict do nothing;
insert into public.recommendation_preferences(user_id) select id from public.profiles on conflict do nothing;

create function app_private.guard_profile() returns trigger language plpgsql set search_path='' as $$
begin
  if old.id<>new.id or (old.username is not null and old.username is distinct from new.username) then raise exception 'Permanent identity cannot be changed.' using errcode='23514'; end if;
  if new.avatar_path is not null and (new.avatar_path !~ ('^' || new.id::text || '/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$')) then raise exception 'Invalid avatar reference.' using errcode='23514'; end if;
  return new;
end; $$;
create trigger profiles_identity before update on public.profiles for each row execute function app_private.guard_profile();

create function public.complete_onboarding(p_username text,p_display_name text,p_categories public.entertainment_kind[] default '{}',p_genres uuid[] default '{}',p_starter_titles uuid[] default '{}') returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); candidate text:=lower(btrim(p_username));
begin
  perform app_private.rate_limit('onboarding',20,interval '1 hour');
  if candidate is null or candidate !~ '^[a-z][a-z0-9_]{2,29}$' or candidate in ('admin','administrator','moderator','scenestack','support','official') then raise exception 'Choose another username.' using errcode='23514'; end if;
  if cardinality(p_categories)>6 or cardinality(p_genres)>100 or cardinality(p_starter_titles)>100 then raise exception 'Invalid preferences.' using errcode='23514'; end if;
  perform 1 from public.profiles where id=who for update;
  if exists(select 1 from public.profiles where id=who and username is not null and username<>candidate) then raise exception 'Permanent username already chosen.' using errcode='23514'; end if;
  update public.profiles set username=candidate,display_name=p_display_name where id=who;
  delete from public.preferred_categories where user_id=who;
  insert into public.preferred_categories select who,x from (select distinct unnest(p_categories) x) q;
  delete from public.favorite_genres where user_id=who;
  insert into public.favorite_genres select who,x from (select distinct unnest(p_genres) x) q;
  insert into public.tracking(user_id,title_id,status) select who,x,'planned' from (select distinct unnest(p_starter_titles) x) q on conflict(user_id,title_id) do nothing;
  update public.onboarding set completed_at=coalesce(completed_at,now()) where user_id=who;
end; $$;

create function app_private.record_tracking_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.profiles where id=old.user_id) then insert into public.tracking_history(user_id,title_id,previous_status,next_status) values(old.user_id,old.title_id,old.status,null); end if;
    return old;
  elsif tg_op='INSERT' then
    insert into public.tracking_history(user_id,tracking_id,title_id,next_status) values(new.user_id,new.id,new.title_id,new.status);
  elsif new.status is distinct from old.status then
    insert into public.tracking_history(user_id,tracking_id,title_id,previous_status,next_status) values(new.user_id,new.id,new.title_id,old.status,new.status);
  end if;
  return new;
end; $$;
create trigger tracking_history_event after insert or update or delete on public.tracking for each row execute function app_private.record_tracking_history();
create function app_private.record_rating_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.profiles where id=old.user_id) then insert into public.rating_history(user_id,title_id,previous_score,next_score) values(old.user_id,old.title_id,old.score,null); end if;
    return old;
  elsif tg_op='INSERT' then
    insert into public.rating_history(user_id,rating_id,title_id,next_score) values(new.user_id,new.id,new.title_id,new.score);
  elsif new.score is distinct from old.score then
    insert into public.rating_history(user_id,rating_id,title_id,previous_score,next_score) values(new.user_id,new.id,new.title_id,old.score,new.score);
  end if;
  return new;
end; $$;
create trigger rating_history_event after insert or update or delete on public.ratings for each row execute function app_private.record_rating_history();
create function public.set_tracking(p_title uuid,p_status public.tracking_status) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('tracking',300,interval '1 hour');
  insert into public.tracking(user_id,title_id,status) values(who,p_title,p_status) on conflict(user_id,title_id) do update set status=excluded.status returning id into result;
  return result;
end; $$;
create function public.set_rating(p_title uuid,p_score numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member(); result uuid;
begin
  perform app_private.rate_limit('rating',300,interval '1 hour');
  insert into public.ratings(user_id,title_id,score) values(who,p_title,p_score) on conflict(user_id,title_id) do update set score=excluded.score returning id into result;
  return result;
end; $$;
create function public.community_rating(p_title uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare total bigint; average numeric;
begin
  -- No identities, contributions, histories, or per-user filtering are accepted.
  -- A minimum cohort of five prevents publishing a single person's rating.
  select count(*),case when count(*)>=5 then round(avg(r.score),1) else null end into total,average
    from public.ratings r join public.profiles p on p.id=r.user_id where r.title_id=p_title and r.eligible and p.status='active';
  return jsonb_build_object('score',average,'voteCount',total,'minimumVotes',5);
end; $$;

-- Safe timestamp triggers (users do not receive write grants on timestamp columns).
do $$ declare t text; begin
  foreach t in array array['profiles','notification_preferences','recommendation_preferences','titles','tracking','ratings','collections','provider_sync_state'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()',t);
  end loop;
end; $$;

-- All public catalog records are non-personal cache data, available to guest detail pages.
do $$ declare t text; begin
  foreach t in array array['titles','title_names','genres','title_genres','countries','languages','title_countries','title_languages','title_artwork','title_trailers','content_warnings','title_content_warnings','people','title_credits','title_relations','title_redirects'] loop
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('create policy catalog_read on public.%I for select to anon, authenticated using (true)',t);
  end loop;
end; $$;
grant select(id,key,name,attribution,terms_url) on public.metadata_providers to anon,authenticated;
create policy provider_attribution_read on public.metadata_providers for select to anon,authenticated using (approved);

create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or app_private.can_interact(id));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid()) and app_private.member()) with check(id=(select auth.uid()) and app_private.member());
grant select on public.profiles to authenticated;
grant update(display_name,avatar_path,bio) on public.profiles to authenticated;

-- Ownership has NO admin override, including private change history.
do $$ declare t text; begin
  foreach t in array array['onboarding','notification_preferences','recommendation_preferences','preferred_categories','favorite_genres','preferred_languages','tracking','tracking_history','ratings','rating_history','favorites','collection_imports','data_export_requests'] loop
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_read on public.%I for select to authenticated using (user_id=(select auth.uid()) and app_private.member())',t);
  end loop;
  foreach t in array array['preferred_categories','favorite_genres','preferred_languages','favorites'] loop
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id=(select auth.uid()) and app_private.member())',t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id=(select auth.uid()) and app_private.member())',t);
    execute format('grant delete on public.%I to authenticated',t);
  end loop;
end; $$;
grant insert(category) on public.preferred_categories to authenticated;
grant insert(genre_id) on public.favorite_genres to authenticated;
grant insert(language_code) on public.preferred_languages to authenticated;
grant insert(title_id) on public.favorites to authenticated;
create policy notification_preferences_update on public.notification_preferences for update to authenticated using(user_id=auth.uid() and app_private.member()) with check(user_id=auth.uid() and app_private.member());
create policy recommendation_preferences_update on public.recommendation_preferences for update to authenticated using(user_id=auth.uid() and app_private.member()) with check(user_id=auth.uid() and app_private.member());
grant update(enabled,new_followers,collection_favorites,followed_collections) on public.notification_preferences to authenticated;
grant update(enabled,include_mature,diversify) on public.recommendation_preferences to authenticated;
create policy tracking_delete on public.tracking for delete to authenticated using(user_id=auth.uid() and app_private.member());
create policy ratings_delete on public.ratings for delete to authenticated using(user_id=auth.uid() and app_private.member());
grant delete on public.tracking,public.ratings to authenticated;

-- Non-exposed helpers: no arbitrary pairwise block lookup or rate-limit bypass.
revoke all on all functions in schema app_private from public,anon,authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.member(),app_private.can_interact(uuid),app_private.can_read_collection(uuid),app_private.owns_collection(uuid),app_private.has_role(public.admin_role) to authenticated;
revoke all on function public.complete_onboarding(text,text,public.entertainment_kind[],uuid[],uuid[]),public.set_tracking(uuid,public.tracking_status),public.set_rating(uuid,numeric),public.community_rating(uuid) from public,anon,authenticated;
grant execute on function public.complete_onboarding(text,text,public.entertainment_kind[],uuid[],uuid[]),public.set_tracking(uuid,public.tracking_status),public.set_rating(uuid,numeric) to authenticated;
grant execute on function public.community_rating(uuid) to anon,authenticated;
commit;
