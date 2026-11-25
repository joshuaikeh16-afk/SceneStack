begin;
create function public.search_creators(p_query text default '',p_limit integer default 24,p_offset integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text:=lower(ltrim(p_query,'@')); payload jsonb;
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 if p_query is null or char_length(p_query)>120 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid creator search.' using errcode='23514';end if;
 select coalesce(jsonb_agg(to_jsonb(p)),'[]') into payload from(select id,username,display_name,avatar_path,bio,created_at from public.profiles where q='' or position(q in lower(display_name))>0 or position(q in lower(coalesce(username,'')))>0 order by display_name,id limit p_limit offset p_offset) p;return payload;
end; $$;
revoke all on function public.search_creators(text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.search_creators(text,integer,integer) to authenticated;
commit;
