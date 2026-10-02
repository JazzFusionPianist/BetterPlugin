-- Trigger-only functions do not need direct Data API execution permission.
revoke execute on function public.enforce_group_member_cap() from public,anon,authenticated;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

-- Dealing already checks the host in its body; require a signed-in API caller too.
revoke execute on function public.poker_deal_hand(uuid,jsonb) from public,anon;
grant execute on function public.poker_deal_hand(uuid,jsonb) to authenticated;

-- These functions only use NEW and pg_catalog.now(); no application search path needed.
alter function public.ear_training_rooms_touch_updated_at() set search_path='';
alter function public.yacht_rooms_touch_updated_at() set search_path='';
alter function public.orb_party_rooms_touch_updated_at() set search_path='';
alter function public.sketch_rooms_touch_updated_at() set search_path='';
alter function public.board_rooms_touch_updated_at() set search_path='';
