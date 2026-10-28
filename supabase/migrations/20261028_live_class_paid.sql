-- auto-apply
-- Weekend Live Class becomes a paid add-on (owner, 2026-10-28):
--   * Premium members only can buy a seat, $5 per class (Stripe Checkout,
--     billing action 'live_checkout').
--   * 8 seats per class. A seat is held while checkout is open (status
--     'pending', hold_until); billing-webhook marks it 'paid' or frees it.
--   * Cancel up to 24 h before class = full refund (billing 'live_cancel').
--   * No recording.
-- Registrations are written only by the billing functions (service role) or
-- the admin; learners read their own rows.

alter table public.weekly_live_registrations
  add column if not exists status text not null default 'comp',
  add column if not exists hold_until timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists amount_cents int,
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists refunded_at timestamptz;
do $$ begin
  alter table public.weekly_live_registrations
    add constraint wlr_status_chk check (status in ('pending', 'paid', 'comp', 'refunded'));
exception when duplicate_object then null; end $$;
create index if not exists wlr_stripe_session_idx on public.weekly_live_registrations (stripe_session_id);
create index if not exists wlr_stripe_pi_idx on public.weekly_live_registrations (stripe_payment_intent);

-- Old free registrations (Premium-included era) get the default 'comp'.

-- No more client inserts / deletes: buying and cancelling go through billing.
drop policy if exists "wlr_self_insert" on public.weekly_live_registrations;
drop policy if exists "weekly_live_registrations insert own" on public.weekly_live_registrations;
drop policy if exists "wlr_self_delete" on public.weekly_live_registrations;
drop policy if exists "wlr_admin_write" on public.weekly_live_registrations;
create policy "wlr_admin_write" on public.weekly_live_registrations for all
  using (public.is_admin_email()) with check (public.is_admin_email());

-- 8 seats from now on.
alter table public.weekly_live_sessions alter column max_attendees set default 8;
update public.weekly_live_sessions set max_attendees = 8
 where scheduled_at > now() and (max_attendees is null or max_attendees > 8);
update public.weekly_live_sessions
   set description = 'This week''s topic and articles, live on Zoom with Han. 60 minutes, 8 seats.'
 where scheduled_at > now() and description like 'This week''s topic, tricky grammar%';

-- Seats taken = paid + complimentary + checkouts still open.
create or replace function public.kh_live_seats_taken(p_session uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.weekly_live_registrations
   where session_id = p_session
     and (status in ('paid', 'comp') or (status = 'pending' and hold_until > now()));
$$;
revoke execute on function public.kh_live_seats_taken(uuid) from public;
grant execute on function public.kh_live_seats_taken(uuid) to anon, authenticated, service_role;

create or replace function public.get_live_registration_counts()
returns table (session_id uuid, n bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.session_id, count(*)::bigint from public.weekly_live_registrations r
   where r.status in ('paid', 'comp') or (r.status = 'pending' and r.hold_until > now())
   group by r.session_id;
$$;
revoke execute on function public.get_live_registration_counts() from public;
grant execute on function public.get_live_registration_counts() to anon, authenticated;

-- Zoom link: paid (or complimentary) seat holders, from 30 min before start.
create or replace function public.get_live_zoom_link(p_session uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  s public.weekly_live_sessions%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then return null; end if;
  select * into s from public.weekly_live_sessions where id = p_session and not is_cancelled;
  if not found then return null; end if;
  if public.is_admin_email() then return s.zoom_link; end if;
  if not exists (select 1 from public.weekly_live_registrations
                  where session_id = p_session and user_id = v_user and status in ('paid', 'comp')) then
    return null;
  end if;
  if now() < s.scheduled_at - interval '30 minutes' then return null; end if;
  if now() > s.scheduled_at + interval '2 hours' then return null; end if;   -- no recording
  return s.zoom_link;
end;
$$;
revoke execute on function public.get_live_zoom_link(uuid) from public;
grant  execute on function public.get_live_zoom_link(uuid) to authenticated;

-- Weekly auto-session: 8 seats, booking closes 1 h before.
create or replace function public.kh_ensure_weekly_live_session()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_monday date := date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;
  v_start  timestamptz := ((v_monday + 6)::timestamp + time '21:00') at time zone 'Asia/Seoul';
  v_id     uuid;
  v_zoom   text;
begin
  select id into v_id from public.weekly_live_sessions
   where scheduled_at >= (v_monday::timestamp at time zone 'Asia/Seoul')
     and scheduled_at <  ((v_monday + 7)::timestamp at time zone 'Asia/Seoul')
   limit 1;
  if v_id is not null then return v_id; end if;
  select value into v_zoom from public.app_settings where key = 'live_class_zoom_link';
  insert into public.weekly_live_sessions (title, description, scheduled_at, registration_deadline, zoom_link, max_attendees)
  values ('Weekend Live Class',
          'This week''s topic and articles, live on Zoom with Han. 60 minutes, 8 seats.',
          v_start, v_start - interval '1 hour', nullif(btrim(coalesce(v_zoom, '')), ''), 8)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.kh_ensure_weekly_live_session() from public;

-- Atomic seat hold for billing 'live_checkout' (service role only). Locks the
-- session row so two buyers can't both take the last seat.
create or replace function public.kh_live_hold_seat(p_session uuid, p_user uuid, p_email text, p_hold_until timestamptz)
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
  values (p_session, p_user, p_email, 'pending', p_hold_until, null, null)
  on conflict (session_id, user_id) do update
    set status = 'pending', hold_until = excluded.hold_until, email = excluded.email,
        stripe_session_id = null, stripe_payment_intent = null, paid_at = null, refunded_at = null;
  return 'ok';
end $$;
revoke execute on function public.kh_live_hold_seat(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.kh_live_hold_seat(uuid, uuid, text, timestamptz) to service_role;
