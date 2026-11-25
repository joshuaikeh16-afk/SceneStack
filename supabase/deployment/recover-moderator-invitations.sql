-- Idempotent recovery; preserves invitation IDs, seat reservations and all roles.
-- Run as postgres. Existing notification preference settings are intentionally irrelevant.
begin;
select pg_advisory_xact_lock(710025);
insert into public.control_notifications(recipient_id,subject,body,href,event_key)
select invited_user_id,'Moderator invitation','Review your invitation to the SceneStack team.','/activity','moderator_invitation:'||id
from public.admin_invitations where status='pending' and expires_at>now()
on conflict(recipient_id,event_key) do nothing;
commit;
