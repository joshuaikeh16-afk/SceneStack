begin;
create function public.followed_collection_feed(p_limit integer default 12,p_offset integer default 0) returns setof public.collections language plpgsql stable security invoker set search_path='' as $$
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 48 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid feed page.' using errcode='23514';end if;
 return query select c.* from public.collections c join public.follows f on f.followed_id=c.owner_id and f.follower_id=auth.uid() where c.visibility='published' order by c.published_at desc nulls last,c.id limit p_limit offset p_offset;
end; $$;
create function public.expire_discovery_history() returns jsonb language plpgsql security definer set search_path='' as $$
declare searches bigint; titles bigint;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501';end if;
 delete from public.recent_searches where searched_at<now()-interval '30 days';get diagnostics searches=row_count;
 delete from public.recent_titles where viewed_at<now()-interval '90 days';get diagnostics titles=row_count;
 return jsonb_build_object('expiredSearches',searches,'expiredTitleViews',titles);
end; $$;
revoke all on function public.followed_collection_feed(integer,integer),public.expire_discovery_history() from public,anon,authenticated,service_role;
grant execute on function public.followed_collection_feed(integer,integer) to authenticated;
grant execute on function public.expire_discovery_history() to service_role;
commit;
