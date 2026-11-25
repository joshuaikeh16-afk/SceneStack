begin;
alter table public.metadata_refresh_requests add column claimed_at timestamptz;
create function public.claim_provider_refreshes(p_provider uuid,p_limit integer default 10) returns setof public.metadata_refresh_requests language plpgsql security definer set search_path='' as $$
declare selected public.metadata_refresh_requests; leased public.metadata_refresh_requests;
begin
 if auth.jwt()->>'role' is distinct from 'service_role' and current_setting('role')<>'service_role' then raise exception 'Trusted worker required.' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 50 or not exists(select 1 from public.metadata_providers where id=p_provider and approved and enabled) then raise exception 'Provider unavailable.' using errcode='42501';end if;
 for selected in select r.* from public.metadata_refresh_requests r where r.provider_id=p_provider and (r.state in ('pending','failed') or r.state='running' and r.claimed_at<now()-interval '15 minutes') and not exists(select 1 from public.metadata_refresh_requests pending where pending.provider_id=p_provider and pending.title_id=r.title_id and pending.id<>r.id and pending.state='pending') and not exists(select 1 from public.provider_sync_state s where s.provider_id=p_provider and s.title_id=r.title_id and s.state='failed' and s.next_attempt_at>now()) and not exists(select 1 from public.metadata_refresh_requests running where running.provider_id=p_provider and running.title_id=r.title_id and running.id<>r.id and running.state='running' and running.claimed_at>=now()-interval '15 minutes') order by r.created_at,r.id for update skip locked limit p_limit loop
  if not exists(select 1 from public.metadata_refresh_requests other where other.provider_id=p_provider and other.title_id=selected.title_id and other.id<>selected.id and other.state='running') then update public.metadata_refresh_requests set state='running',claimed_at=now(),finished_at=null where id=selected.id returning * into leased;return next leased;end if;
 end loop;
end; $$;
revoke all on function public.claim_provider_refreshes(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_provider_refreshes(uuid,integer) to service_role;
commit;
