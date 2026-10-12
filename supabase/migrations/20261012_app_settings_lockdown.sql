-- auto-apply
-- SECURITY: app_settings secrets were readable by clients.
-- Live check 2026-10-12: policy "authenticated reads settings"
--   USING (auth.role() = 'authenticated' OR key <> 'anthropic_key')
-- let ANY signed-in user read anthropic_key, and anon read every other key
-- (pexels_key, azure_speech_key, and future stripe_secret_key /
-- stripe_billing_webhook_secret / elevenlabs_key / live_class_zoom_link).
-- Replace every client SELECT policy with ONE allow-list of non-secret keys
-- the frontend actually reads. Admin keeps full access through
-- "admin writes settings" (ALL, admin email). Edge functions use the service
-- role and are unaffected. After this, rotate any key that was exposed.

do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'app_settings' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.app_settings', p.policyname);
  end loop;
end $$;

create policy "app_settings public read"
  on public.app_settings for select
  using (
    key = any (array[
      'phrases', 'phrase_rotation_offset', 'site_config', 'sections',
      'shop_items_fallback', 'shop_items_v1', 'quick_win_tips',
      'reporter_bg_image_url', 'onboarding_content'
    ])
    or key like 'shop_items\_%'
    or key like 'reporter_posts_fallback\_%'
    -- per-user fallbacks: only the owner's own rows
    or (auth.uid() is not null and key = 'room_data_' || auth.uid()::text)
    or (auth.uid() is not null and key like 'kh\_affinity\_fb\_' || auth.uid()::text || '\_%')
  );

-- Live class: registrations exposed every registrant's email (wlr_count_read
-- USING true). Learners now read only their own rows; seat counts come from
-- a SECURITY DEFINER function that returns numbers only.
drop policy if exists "wlr_count_read" on public.weekly_live_registrations;
drop policy if exists "weekly_live_registrations insert own" on public.weekly_live_registrations;
drop policy if exists "wlr_self_read" on public.weekly_live_registrations;
create policy "wlr_self_read"
  on public.weekly_live_registrations for select
  using (auth.uid() = user_id or public.is_admin_email());

create or replace function public.get_live_registration_counts()
returns table (session_id uuid, n bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.session_id, count(*)::bigint from public.weekly_live_registrations r group by r.session_id;
$$;
revoke execute on function public.get_live_registration_counts() from public;
grant execute on function public.get_live_registration_counts() to anon, authenticated;

-- Admin "save Zoom link": the client UPDATE filtered on zoom_link, a column
-- authenticated can no longer SELECT, so it failed silently and upcoming
-- sessions kept a NULL link. Do it server-side (admin only).
create or replace function public.kh_fill_live_zoom_link(p_link text)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  if not public.is_admin_email() then raise exception 'forbidden'; end if;
  if p_link is null or p_link !~ '^https://' then raise exception 'invalid link'; end if;
  update public.weekly_live_sessions set zoom_link = p_link
   where (zoom_link is null or zoom_link = '') and scheduled_at >= now() and not is_cancelled;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.kh_fill_live_zoom_link(text) from public;
grant execute on function public.kh_fill_live_zoom_link(text) to authenticated;
