-- Fix admin RLS policies for the gacha + weekly_live_sessions tables.
-- The original migrations assumed an `app_settings.admin_user_ids` row
-- with a JSONB array of user IDs, but this codebase actually identifies
-- admins via the `public.is_admin_email()` function (defined in
-- 20260408_security_hotfix_rls_and_search_path.sql, reads the JWT email
-- and checks against a hard-coded list).
--
-- Without this fix, any admin INSERT into weekly_live_sessions or
-- gacha_items returns "new row violates row-level security policy".

drop policy if exists "wls_admin_write" on weekly_live_sessions;
create policy "wls_admin_write"
  on weekly_live_sessions for all
  using (public.is_admin_email())
  with check (public.is_admin_email());

drop policy if exists "gacha_items_admin_write" on public.gacha_items;
create policy "gacha_items_admin_write"
  on public.gacha_items for all
  using (public.is_admin_email())
  with check (public.is_admin_email());
