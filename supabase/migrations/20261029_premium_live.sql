-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Premium Live plan (owner decision, 2026-10-29)
-- ═════════════════════════════════════════════════════════════════════
-- * Premium stays $8.99/month or $69/year: every self-study feature, but
--   NO live class any more. The $5 single-seat purchase goes away
--   (billing 'live_checkout' is removed; legacy paid seats keep working
--   and can still be refunded through billing 'live_cancel').
-- * New plan 'premium_live': $27.99/month, monthly only. Everything in
--   Premium + one live class every week with a seat included (Sunday
--   21:00 KST on Zoom, 60 min, 8 seats per class). Members book / cancel
--   an included seat until booking closes (registration_deadline, 1 h
--   before). Missed classes do not roll over.
-- * user_subscriptions.plan is plain text (no CHECK constraint — see
--   20260412_user_subscriptions.sql), so 'premium_live' needs no schema
--   change. billing-webhook writes it from the Stripe price lookup_key
--   'kh_premium_live_month'.
-- * Included seats are stored as weekly_live_registrations status 'comp'
--   and written only by billing (service role) through
--   kh_live_reserve_seat(), which locks the session row exactly like
--   kh_live_hold_seat() so two members can't both take the last seat.
-- Idempotent: safe to run more than once.

-- Premium Live includes everything in Premium.
create or replace function public.kh_is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_subscriptions
     where user_id = p_user
       and status = 'active'
       and plan in ('premium', 'premium_live', 'standard', 'pro')
       and (expires_at is null or expires_at > now())
  );
$$;
revoke execute on function public.kh_is_premium(uuid) from public;
grant  execute on function public.kh_is_premium(uuid) to authenticated, service_role;

-- Live class access = an active, unexpired Premium Live subscription.
create or replace function public.kh_has_live(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_subscriptions
     where user_id = p_user
       and status = 'active'
       and plan = 'premium_live'
       and (expires_at is null or expires_at > now())
  );
$$;
revoke execute on function public.kh_has_live(uuid) from public;
grant  execute on function public.kh_has_live(uuid) to authenticated, service_role;

-- Atomic included-seat booking for billing 'live_reserve' (service role
-- only). Returns 'no_session' | 'booked' (already paid / comp) | 'full' | 'ok'.
-- The caller checks the plan and that booking is still open.
create or replace function public.kh_live_reserve_seat(p_session uuid, p_user uuid, p_email text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cap int;
  v_taken int;
  v_mine public.weekly_live_registrations%rowtype;
begin
  select coalesce(max_attendees, 8) into v_cap from public.weekly_live_sessions where id = p_session for update;
  if not found then return 'no_session'; end if;
  select * into v_mine from public.weekly_live_registrations where session_id = p_session and user_id = p_user;
  if found and v_mine.status in ('paid', 'comp') then return 'booked'; end if;
  select count(*)::int into v_taken from public.weekly_live_registrations
   where session_id = p_session and user_id <> p_user
     and (status in ('paid', 'comp') or (status = 'pending' and hold_until > now()));
  if v_taken >= v_cap then return 'full'; end if;
  insert into public.weekly_live_registrations (session_id, user_id, email, status, hold_until, stripe_session_id, refunded_at)
  values (p_session, p_user, p_email, 'comp', null, null, null)
  on conflict (session_id, user_id) do update
    set status = 'comp', hold_until = null, email = excluded.email,
        stripe_session_id = null, stripe_payment_intent = null, paid_at = null,
        amount_cents = null, refunded_at = null;
  return 'ok';
end $$;
revoke execute on function public.kh_live_reserve_seat(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.kh_live_reserve_seat(uuid, uuid, text) to service_role;
