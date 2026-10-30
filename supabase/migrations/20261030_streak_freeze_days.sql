-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Streak Freeze days count in the real streak + server-computed awards
-- (2026-10-30 security pass)
-- ═════════════════════════════════════════════════════════════════════
-- 1. user_streak_freezes(user_id, day) — one row per KST day a Streak Freeze
--    covered. Owner SELECT only; no client writes (only the SECURITY DEFINER
--    consume_streak_freeze below inserts).
-- 2. consume_streak_freeze(p_for_date) now
--      * freezes a KST day: p_for_date when it is yesterday or the day before
--        (KST), otherwise KST yesterday (the browser sent UTC dates, and
--        khFreezeUse() defaults to today);
--      * is idempotent per day: a second call for an already-frozen day spends
--        nothing and posts nothing (two tabs / pages used to spend two freezes
--        and post "We used a streak freeze…" twice);
--      * refuses to spend on a day that already has daily_missions activity;
--      * posts at most one 'streak_freeze_used' notification per user per KST
--        day.
-- 3. kh_user_streak(p_user) treats frozen days as active days.
-- 4. claim_streak_award(p_streak) ignores the client's number and computes the
--    streak itself with kh_user_streak(auth.uid()) (p_streak kept only for
--    signature compatibility); at most one 'streak_freeze_awarded'
--    notification per user per KST day.
-- Schema/function changes only; no existing rows are rewritten.
-- Idempotent: safe to re-run.

create table if not exists public.user_streak_freezes (
  user_id    uuid not null,
  day        date not null,
  created_at timestamptz default now(),
  primary key (user_id, day)
);
alter table public.user_streak_freezes enable row level security;
revoke all on public.user_streak_freezes from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_streak_freezes from authenticated;
grant select on public.user_streak_freezes to authenticated;
drop policy if exists user_streak_freezes_own_read on public.user_streak_freezes;
create policy user_streak_freezes_own_read on public.user_streak_freezes
  for select to authenticated using (user_id = auth.uid());

-- ── kh_user_streak: activity days + frozen days ─────────────────────────
-- Same rule as before (consecutive KST days counting from today, or from
-- yesterday when nothing is logged yet today), with Streak Freeze days
-- counted as active.
create or replace function public.kh_user_streak(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with today as (select (now() at time zone 'Asia/Seoul')::date as d),
  days as (
    select m.date::date as d
      from public.daily_missions m, today t
     where m.user_id = p_user
       and coalesce(m.articles, 0) + coalesce(m.words, 0) + coalesce(m.quizzes, 0) + coalesce(m.fill, 0) > 0
       and m.date::date between t.d - 400 and t.d
    union
    select f.day
      from public.user_streak_freezes f, today t
     where f.user_id = p_user
       and f.day between t.d - 400 and t.d
  ),
  start as (
    select case when exists (select 1 from days, today where days.d = today.d)
                then (select d from today) else (select d - 1 from today) end as s
  ),
  ranked as (
    select days.d, row_number() over (order by days.d desc) as rn
      from days, start where days.d <= start.s
  )
  select count(*)::int from ranked, start where ranked.d = start.s - (ranked.rn - 1)::int;
$$;

revoke all on function public.kh_user_streak(uuid) from public;
revoke all on function public.kh_user_streak(uuid) from anon;
grant execute on function public.kh_user_streak(uuid) to authenticated, service_role;

-- ── consume_streak_freeze ──────────────────────────────────────────────
create or replace function public.consume_streak_freeze(p_for_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_date  date;
  v_count int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  v_date := case when p_for_date between v_today - 2 and v_today - 1 then p_for_date
                 else v_today - 1 end;

  -- Row lock serialises concurrent calls from several tabs / pages.
  select freeze_count into v_count
    from public.profiles where id = v_user for update;

  if exists (select 1 from public.user_streak_freezes where user_id = v_user and day = v_date) then
    return jsonb_build_object('ok', true, 'already', true,
                              'date', to_char(v_date, 'YYYY-MM-DD'), 'remaining', coalesce(v_count, 0));
  end if;

  if exists (
    select 1 from public.daily_missions m
     where m.user_id = v_user and m.date::date = v_date
       and coalesce(m.articles, 0) + coalesce(m.words, 0) + coalesce(m.quizzes, 0) + coalesce(m.fill, 0) > 0) then
    return jsonb_build_object('ok', false, 'error', 'not_needed', 'date', to_char(v_date, 'YYYY-MM-DD'));
  end if;

  if v_count is null or v_count <= 0 then
    return jsonb_build_object('ok', false, 'error', 'no_freezes');
  end if;

  update public.profiles
     set freeze_count = freeze_count - 1,
         streak_freeze_used_week = now(),
         updated_at = now()
   where id = v_user;

  insert into public.user_streak_freezes (user_id, day) values (v_user, v_date)
  on conflict (user_id, day) do nothing;

  -- One "We used a streak freeze…" per learner per KST day.
  if not exists (
    select 1 from public.notifications
     where user_id = v_user and kind = 'streak_freeze_used'
       and created_at >= (v_today::timestamp at time zone 'Asia/Seoul')) then
    insert into public.notifications (user_id, kind, payload)
    values (v_user, 'streak_freeze_used',
            jsonb_build_object('date', to_char(v_date, 'YYYY-MM-DD'), 'remaining', v_count - 1));
  end if;

  return jsonb_build_object('ok', true, 'date', to_char(v_date, 'YYYY-MM-DD'), 'remaining', v_count - 1);
end;
$$;

revoke all on function public.consume_streak_freeze(date) from public;
revoke all on function public.consume_streak_freeze(date) from anon;
grant execute on function public.consume_streak_freeze(date) to authenticated;

-- ── claim_streak_award: streak computed on the server ──────────────────
-- Same logic as 20261029_streak_award_fix.sql (profiles.last_award_streak,
-- inventory capped at 3, a broken streak earns again), but the streak is
-- kh_user_streak(auth.uid()) — the client's p_streak is ignored, so a
-- console call with p_streak => 999 no longer mints freezes.
create or replace function public.claim_streak_award(p_streak integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'Asia/Seoul')::date;
  v_streak    int  := 0;
  v_prev_high int  := 0;
  v_count     int  := 0;
  v_awarded   int  := 0;
  v_left      int  := 0;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', 0, 'error', 'not_signed_in');
  end if;

  select coalesce(last_award_streak, 0), coalesce(freeze_count, 0)
    into v_prev_high, v_count
    from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('awarded', 0);
  end if;

  v_streak := coalesce(public.kh_user_streak(v_uid), 0);
  if v_streak < 3 then
    return jsonb_build_object('awarded', 0, 'streak', v_streak);
  end if;

  -- A new, shorter run than the one we last paid for = the streak broke.
  if v_streak < v_prev_high then v_prev_high := 0; end if;

  v_awarded := greatest(0, (v_streak / 3) - (v_prev_high / 3));
  if v_awarded = 0 then
    return jsonb_build_object('awarded', 0, 'streak', v_streak);
  end if;

  v_left := least(v_count + v_awarded, 3);
  update public.profiles
     set freeze_count      = v_left,
         last_award_streak = v_streak
   where id = v_uid;

  -- Only tell the learner when the inventory actually grew, once a KST day.
  if v_left > v_count and not exists (
    select 1 from public.notifications
     where user_id = v_uid and kind = 'streak_freeze_awarded'
       and created_at >= (v_today::timestamp at time zone 'Asia/Seoul')) then
    insert into public.notifications (user_id, kind, payload)
    values (v_uid, 'streak_freeze_awarded',
            jsonb_build_object('granted', v_left - v_count, 'streak', v_streak, 'remaining', v_left));
  end if;

  return jsonb_build_object('awarded', v_left - v_count, 'streak', v_streak, 'remaining', v_left);
end;
$function$;

revoke all on function public.claim_streak_award(integer) from public;
revoke all on function public.claim_streak_award(integer) from anon;
grant execute on function public.claim_streak_award(integer) to authenticated;

notify pgrst, 'reload schema';
