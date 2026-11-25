begin;
-- Both buckets are private: profiles are member-visible and collection visibility can change.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('scenestack-avatars','scenestack-avatars',false,3145728,array['image/jpeg','image/png','image/webp']),
  ('scenestack-collection-covers','scenestack-collection-covers',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function app_private.read_avatar(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.profiles p where p.id::text=split_part(p_name,'/',1) and p_name ~ '^[a-f0-9-]{36}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' and
    (p.id=auth.uid() or (p.avatar_path=p_name and app_private.can_interact(p.id))));
$$;
create function app_private.write_avatar(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and p_name ~ ('^'||auth.uid()::text||'/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$');
$$;
create function app_private.read_cover(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.collections c where c.owner_id::text=split_part(p_name,'/',1) and c.id::text=split_part(p_name,'/',2) and
    p_name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' and
    (app_private.owns_collection(c.id) or ((c.cover_path=p_name or c.collage_reference=p_name) and app_private.can_read_collection(c.id))));
$$;
create function app_private.write_cover(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  select app_private.member() and exists(select 1 from public.collections c where c.owner_id=auth.uid() and c.owner_id::text=split_part(p_name,'/',1) and c.id::text=split_part(p_name,'/',2) and
    c.removed_at is null and p_name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$');
$$;
revoke all on function app_private.read_avatar(text),app_private.write_avatar(text),app_private.read_cover(text),app_private.write_cover(text) from public,anon,authenticated;
-- PostgreSQL checks policy-function EXECUTE privileges before CASE short-circuiting.
-- These non-exposed helpers must be callable by anon for unrelated Storage policies
-- to keep working. They all explicitly return false without an active auth.uid().
grant usage on schema app_private to anon;
grant execute on function app_private.read_avatar(text),app_private.write_avatar(text),app_private.read_cover(text),app_private.write_cover(text) to anon,authenticated;

create policy scenestack_asset_read on storage.objects for select to authenticated using(
  (bucket_id='scenestack-avatars' and app_private.read_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.read_cover(name)));
create policy scenestack_asset_insert on storage.objects for insert to authenticated with check(owner_id=auth.uid()::text and
  ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))));
create policy scenestack_asset_update on storage.objects for update to authenticated using(owner_id=auth.uid()::text and
  ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name)))) with check(owner_id=auth.uid()::text and
  ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))));
create policy scenestack_asset_delete on storage.objects for delete to authenticated using(owner_id=auth.uid()::text and
  ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))));

-- Restrictive boundaries prevent pre-existing broad Storage policies from opening these buckets.
-- anon is denied before evaluating private helper calls (which anon cannot execute).
create policy scenestack_read_boundary on storage.objects as restrictive for select to anon,authenticated using(
  bucket_id not in ('scenestack-avatars','scenestack-collection-covers') or case when auth.uid() is null then false else
    (bucket_id='scenestack-avatars' and app_private.read_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.read_cover(name)) end);
create policy scenestack_insert_boundary on storage.objects as restrictive for insert to anon,authenticated with check(
  bucket_id not in ('scenestack-avatars','scenestack-collection-covers') or case when auth.uid() is null then false else owner_id=auth.uid()::text and
    ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))) end);
create policy scenestack_update_boundary on storage.objects as restrictive for update to anon,authenticated using(
  bucket_id not in ('scenestack-avatars','scenestack-collection-covers') or case when auth.uid() is null then false else owner_id=auth.uid()::text and
    ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))) end) with check(
  bucket_id not in ('scenestack-avatars','scenestack-collection-covers') or case when auth.uid() is null then false else owner_id=auth.uid()::text and
    ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))) end);
create policy scenestack_delete_boundary on storage.objects as restrictive for delete to anon,authenticated using(
  bucket_id not in ('scenestack-avatars','scenestack-collection-covers') or case when auth.uid() is null then false else owner_id=auth.uid()::text and
    ((bucket_id='scenestack-avatars' and app_private.write_avatar(name)) or (bucket_id='scenestack-collection-covers' and app_private.write_cover(name))) end);
commit;
