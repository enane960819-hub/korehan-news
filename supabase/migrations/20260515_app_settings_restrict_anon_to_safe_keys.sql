-- SECURITY HOTFIX: narrow app_settings public read policy.
--
-- The previous migration (20260515_all_public_tables_anon_rls.sql)
-- granted `USING (true)` on app_settings to public. That's wrong —
-- this table also stores service-role secrets read by edge functions:
--
--   anthropic_key        — Claude API key (supabase/functions/claude-proxy)
--   resend_key           — Resend API key (newsletter-send)
--   azure_speech_key     — Azure TTS key (speech-proxy)
--   azure_speech_region  — Azure region (less sensitive)
--   pexels_key           — Pexels API key (image-search)
--   signup_notify_webhook — webhook URL (notify-signup)
--
-- Anon SELECT * on app_settings exfiltrates every one of these.
-- Flagged by Codex review on PR #505. Owner: must rotate any keys
-- that may have been exposed while the previous policy was live.
--
-- This migration replaces the over-broad policy with an explicit
-- allowlist of keys that ARE safe for anon to read:
--
--   phrases                  — Today's Phrase queue (already public via CDN)
--   phrase_rotation_offset   — int, rotation pointer
--   site_config              — non-secret display config
--   sections                 — section catalog
--   shop_items_fallback      — shop item list fallback
--   shop_items_v1            — shop item list current
--
-- Per-user room data (`room_data_<uuid>`) was also stored in
-- app_settings. That's bad schema but for now we allow the
-- `room_data_*` prefix via LIKE so per-user gameplay doesn't break.
-- Migrate this to its own user-keyed table post-launch.

DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;

CREATE POLICY "app_settings public read"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (
    key IN (
      'phrases',
      'phrase_rotation_offset',
      'site_config',
      'sections',
      'shop_items_fallback',
      'shop_items_v1',
      'admin_emails'  -- non-secret list of admin emails; used by client to gate UI
    )
    OR key LIKE 'room_data_%'
    OR key LIKE 'shop_items_%'
  );

-- Authenticated users keep the same read (the policy is on public,
-- which authenticated implicitly is a member of, so no separate
-- policy needed). Service-role bypasses RLS so edge functions and
-- admin pages still read every key as before.

NOTIFY pgrst, 'reload schema';
