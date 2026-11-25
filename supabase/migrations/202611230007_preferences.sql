begin;
create function public.set_discovery_preferences(p_categories public.entertainment_kind[] default '{}',p_genres uuid[] default '{}',p_languages text[] default '{}') returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=app_private.require_member();
begin
  perform app_private.rate_limit('preferences',60,interval '1 hour');
  if p_categories is null or p_genres is null or p_languages is null or cardinality(p_categories)>6 or cardinality(p_genres)>100 or cardinality(p_languages)>100 then raise exception 'Invalid preferences.' using errcode='23514'; end if;
  delete from public.preferred_categories where user_id=who;
  insert into public.preferred_categories select who,x from (select distinct unnest(p_categories) x) q;
  delete from public.favorite_genres where user_id=who;
  insert into public.favorite_genres select who,x from (select distinct unnest(p_genres) x) q;
  delete from public.preferred_languages where user_id=who;
  insert into public.preferred_languages select who,x from (select distinct unnest(p_languages) x) q;
end; $$;
revoke all on function public.set_discovery_preferences(public.entertainment_kind[],uuid[],text[]) from public,anon,authenticated;
grant execute on function public.set_discovery_preferences(public.entertainment_kind[],uuid[],text[]) to authenticated;
-- Malformed reports cannot name two targets; deletion may anonymize either FK later.
alter table public.reports add constraint report_single_target check(target_user_id is null or collection_id is null);
commit;
