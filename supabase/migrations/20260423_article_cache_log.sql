-- Article cache generation log.
--
-- genCache() fires-and-forgets vocab/grammar/translation/quiz generation
-- after every article publish. Failures used to disappear into catch{}
-- blocks with no paper trail, which made 'why is Vocab tab empty?'
-- debuggable only by manually re-triggering generation from the admin
-- panel. This table records every attempt so the AI Cache admin page
-- can surface recent errors and offer a one-click retry.
--
-- Rows are intentionally append-only. Keep the latest N days via a
-- cron / manual cleanup; this table will grow roughly at (articles
-- published × 4 steps + 1 save row) per day.

CREATE TABLE IF NOT EXISTS public.article_cache_generation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  text NOT NULL,
  step        text NOT NULL,       -- 'translation' | 'vocab' | 'grammar' | 'quiz' | 'save'
  status      text NOT NULL,       -- 'ok' | 'claude_error' | 'parse_error' | 'db_error' | 'no_json' | 'empty'
  error_message text,
  duration_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acgl_article_created
  ON public.article_cache_generation_log (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acgl_recent_errors
  ON public.article_cache_generation_log (created_at DESC)
  WHERE status <> 'ok';

ALTER TABLE public.article_cache_generation_log ENABLE ROW LEVEL SECURITY;

-- Admin (service role) full access. Authenticated users can INSERT their
-- own rows because the logger runs from the admin browser with the
-- logged-in admin's JWT + the anon key — the entry-point is gated by
-- the admin UI.
DROP POLICY IF EXISTS "acgl_service_full" ON public.article_cache_generation_log;
CREATE POLICY "acgl_service_full"
  ON public.article_cache_generation_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "acgl_auth_insert" ON public.article_cache_generation_log;
CREATE POLICY "acgl_auth_insert"
  ON public.article_cache_generation_log FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "acgl_auth_read" ON public.article_cache_generation_log;
CREATE POLICY "acgl_auth_read"
  ON public.article_cache_generation_log FOR SELECT TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
