-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Premium content no longer readable signed-out; plan lookups are private
-- (2026-10-30 security pass)
-- ═════════════════════════════════════════════════════════════════════
-- A. kh_is_premium(p_user)
--    * was EXECUTE-able by anon (Supabase default privileges), and by any
--      signed-in user for ANY user id → anyone could probe who pays.
--    * now: revoked from anon; for browser roles it answers only about the
--      caller (p_user = auth.uid()) or for the admin; service_role, cron and
--      SECURITY DEFINER internals (auth.role() not anon/authenticated) keep
--      full use. No client code calls it (grep korehan/), only SQL + Edge
--      Functions (service role).
--    * kh_my_premium() — new, no argument, "is the CALLER premium?". Safe to
--      grant to anon (always false for anon). RLS policies use it, because a
--      policy that names kh_is_premium() would make anon's SELECT fail with
--      "permission denied for function" now that anon lost EXECUTE.
--    * topik_items_read is recreated with kh_my_premium() (same meaning) so
--      signed-out visitors keep reading free TOPIK tests.
-- B. kh_ensure_weekly_live_session() — only pg_cron and migrations call it
--    (admin CMS only mentions it in a comment). Revoked from anon and
--    authenticated: a signed-in user could create the week's session row.
-- C. Premium content tables. Every one was `select using (true)` for anon
--    (verified with an anon REST probe on 2026-10-30). Per table, from the
--    client reads in korehan/ and the plan table in js/core/plans.js:
--    * article_study_content — read only by Article Study
--      (korehan-study-room.js, behind requirePlan('article_study'), Premium).
--      → Premium-only: signed-in + kh_my_premium(), or admin.
--    * fast_track_scenarios — read only by openFastTrack() after
--      requirePlan('fast_track') (Premium; the page keeps a built-in fallback
--      list). → Premium-only.
--    * listening_quiz_bank — read only after requirePlan('listening_quiz')
--      (Premium). → Premium-only.
--    * phone_calls — loadPhoneCalls() may run for everyone, but the modal is
--      behind requirePlan('phone_call') (Premium); a free account now just
--      gets an empty list it never shows. → Premium-only.
--    * study_daily_content — MIXED: the weekly topic lesson is part of the
--      Free plan (landing page), Premium adds the rest of the package. The
--      Study Room shows signed-out visitors a hard-coded sample behind the
--      login wall and only queries the table for signed-in users. Rows can't
--      be split by plan (one row per week+level holds both). → signed-in
--      only (no anon).
--    * korean_slangs — MIXED: "Today's 3 slang words" is Free (daily_slang_3),
--      the full list/quiz is Premium (slang_full). The 3 are picked in the
--      browser from the full list, so rows can't be restricted by plan
--      without a server-side picker. → signed-in only (no anon); the page
--      falls back to its built-in list when it gets no rows.
--    Existing SELECT policies on these tables (any name) and any FOR ALL
--    policy open to every caller / every signed-in user are dropped; admin /
--    service-role write policies are kept. service_role bypasses RLS, so
--    Edge Functions (admin-api, content-qa, daily-content-gen, phone-call-gen)
--    are unaffected.
-- Policy/function/grant changes only; no rows are touched.
-- Idempotent: safe to re-run.

-- ── A. kh_is_premium / kh_my_premium ──────────────────────────────────
create or replace function public.kh_is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (p_user = auth.uid()
          or coalesce(auth.role(), '') not in ('anon', 'authenticated')
          or public.is_admin_email())
     and exists (
       select 1 from public.user_subscriptions
        where user_id = p_user
          and status = 'active'
          and plan in ('premium', 'premium_live', 'standard', 'pro')
          and (expires_at is null or expires_at > now())
     );
$$;
revoke all on function public.kh_is_premium(uuid) from public;
revoke all on function public.kh_is_premium(uuid) from anon;
grant execute on function public.kh_is_premium(uuid) to authenticated, service_role;

create or replace function public.kh_my_premium()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and public.kh_is_premium(auth.uid());
$$;
revoke all on function public.kh_my_premium() from public;
grant execute on function public.kh_my_premium() to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.topik_items') is not null and to_regclass('public.topik_tests') is not null then
    drop policy if exists "topik_items_read" on public.topik_items;
    create policy "topik_items_read" on public.topik_items for select
      using (public.is_admin_email() or exists (
        select 1 from public.topik_tests t where t.id = test_id and t.status = 'published'
          and (t.free or (select public.kh_my_premium()))));
  end if;
end $$;

-- ── B. kh_ensure_weekly_live_session: cron / migrations only ─────────
do $$
begin
  if to_regprocedure('public.kh_ensure_weekly_live_session()') is not null then
    revoke all on function public.kh_ensure_weekly_live_session() from public;
    revoke all on function public.kh_ensure_weekly_live_session() from anon;
    revoke all on function public.kh_ensure_weekly_live_session() from authenticated;
    grant execute on function public.kh_ensure_weekly_live_session() to service_role;
  end if;
end $$;

-- ── C. Content tables ────────────────────────────────────────────────
do $$
declare
  v_premium text[] := array['article_study_content', 'fast_track_scenarios', 'listening_quiz_bank', 'phone_calls'];
  v_signed  text[] := array['study_daily_content', 'korean_slangs'];
  t text;
  r record;
begin
  foreach t in array v_premium || v_signed loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table missing', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
         and policyname not in ('kh_premium_read', 'kh_signed_in_read')
         and (cmd = 'SELECT'
              or (cmd = 'ALL' and (coalesce(qual, 'true') in ('true', '(true)')
                                   or qual ilike '%''authenticated''%'
                                   or qual ilike '%''anon''%')))
    loop
      execute format('drop policy %I on public.%I', r.policyname, t);
      raise notice 'dropped policy % on %', r.policyname, t;
    end loop;
    execute format('drop policy if exists kh_premium_read on public.%I', t);
    execute format('drop policy if exists kh_signed_in_read on public.%I', t);
    if t = any(v_premium) then
      execute format(
        'create policy kh_premium_read on public.%I for select to authenticated '
        'using ((select public.kh_my_premium()) or public.is_admin_email())', t);
    else
      execute format('create policy kh_signed_in_read on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
