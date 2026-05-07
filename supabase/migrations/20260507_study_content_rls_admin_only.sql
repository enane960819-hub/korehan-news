-- Lock down study_topic_schedule + study_daily_content writes
-- ================================================================
-- The original policies (20260401, 20260402) shipped with
-- `FOR ALL USING (true) WITH CHECK (true)` because the admin tooling
-- runs through PostgREST with the user's JWT (no service role on the
-- frontend). That left both tables wide open: any anonymous client
-- could DELETE / UPDATE / INSERT and wipe the curriculum.
--
-- Tighten to:
--   SELECT — anyone (still public read; the study room renders for
--            unauthenticated visitors as a teaser)
--   ALL    — only the admin email (auth.jwt() -> 'email')
--
-- Service role is implicitly allowed; PostgREST bypasses RLS when
-- using the service key, which is what the admin-api edge function
-- uses for bulk-gen.

-- ── study_topic_schedule ───────────────────────────────────────
DROP POLICY IF EXISTS "study_topic_schedule_write" ON public.study_topic_schedule;
CREATE POLICY "study_topic_schedule_admin_write"
  ON public.study_topic_schedule
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' IN ('enane960819@gmail.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('enane960819@gmail.com'));

-- ── study_daily_content ────────────────────────────────────────
DROP POLICY IF EXISTS "study_daily_content_write" ON public.study_daily_content;
CREATE POLICY "study_daily_content_admin_write"
  ON public.study_daily_content
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' IN ('enane960819@gmail.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('enane960819@gmail.com'));
