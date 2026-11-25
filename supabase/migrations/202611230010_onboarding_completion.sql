begin;
alter table public.onboarding add column draft_starter_titles uuid[] not null default '{}';
create function public.save_onboarding_starters(p_titles uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
 if p_titles is null or cardinality(p_titles)>100 or exists(select 1 from unnest(p_titles) x where x is null or not exists(select 1 from public.titles t where t.id=x and t.status<>'merged')) then raise exception 'Invalid starter titles.' using errcode='23514'; end if;
 update public.onboarding set draft_starter_titles=p_titles where user_id=who and completed_at is null;
end; $$;
create function public.my_library_counts() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if not app_private.member() then raise exception 'Access unavailable.' using errcode='42501';end if;
 return jsonb_build_object('tracking',(select count(*) from public.tracking where user_id=who),'favorites',(select count(*) from public.favorites where user_id=who),'ratings',(select count(*) from public.ratings where user_id=who),'collections',(select count(*) from public.collections where owner_id=who));
end; $$;
revoke all on function public.save_onboarding_starters(uuid[]),public.my_library_counts() from public,anon,authenticated,service_role;
grant execute on function public.save_onboarding_starters(uuid[]),public.my_library_counts() to authenticated;
commit;
