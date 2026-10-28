-- auto-apply
-- Sweep of write policies that any signed-in user passed (report
-- 2026-10-28_permissive_write_policies.sql). Content tables become
-- admin-write; counters/logs are written by SECURITY DEFINER RPCs or the
-- service role, which bypass RLS. Kept on purpose: newsletter_subs /
-- page_views / trial_requests public inserts (sign-up forms, view logging).
-- Idempotent.

-- Fast Track scenarios and the grammar curriculum: only the admin CMS writes them.
drop policy if exists "Auth write" on public.fast_track_scenarios;
drop policy if exists "fast_track_scenarios admin write" on public.fast_track_scenarios;
create policy "fast_track_scenarios admin write" on public.fast_track_scenarios
  for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());

drop policy if exists "Authenticated can write grammar_curriculum" on public.grammar_curriculum;
drop policy if exists "grammar_curriculum admin write" on public.grammar_curriculum;
create policy "grammar_curriculum admin write" on public.grammar_curriculum
  for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());

-- Nothing in the app inserts game packs from the browser.
drop policy if exists "Authenticated users can insert" on public.vocabulary_game_packs;
drop policy if exists "vocabulary_game_packs admin write" on public.vocabulary_game_packs;
create policy "vocabulary_game_packs admin write" on public.vocabulary_game_packs
  for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());

-- View counts go through increment_article_view (security definer); readers
-- keep the separate public read policy.
drop policy if exists "authenticated upsert article views" on public.article_views;

-- Generation log is written by admin-api (service role).
drop policy if exists acgl_auth_insert on public.article_cache_generation_log;

-- "service full" policy with no condition; the service role bypasses RLS anyway.
drop policy if exists ftp_service_full on public.fast_track_progress;
