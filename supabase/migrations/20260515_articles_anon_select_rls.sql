-- articles + supporting public-read tables: assert correct anon RLS.
--
-- Owner-reported: home hero blank for anon visitors. conversations_data,
-- stories_data, app_settings all load fine for the same anon — only
-- `articles` returns 0 rows. PostgREST returns `{data: [], error: null}`
-- when RLS hides everything (no error, no rows), so the frontend's
-- error path never fires and the user just sees a blank hero forever.
--
-- This migration is idempotent. It:
--   1) enables RLS on articles (no-op if already enabled)
--   2) drops every prior policy that gates SELECT (so old over-strict
--      policies don't shadow the new one)
--   3) creates one policy: anyone (including anon) can SELECT rows
--      where status = 'published' OR status IS NULL
--
-- Authenticated writes are intentionally NOT touched — the admin
-- panel uses the service-role key via the admin-api edge function,
-- which bypasses RLS entirely. So we don't need INSERT/UPDATE/DELETE
-- policies here.
--
-- Re-running this against a healthy schema is safe: the DROP IF EXISTS
-- + CREATE pattern replaces the policy without downtime.

-- 1) articles ----------------------------------------------------------------

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles public read"        ON public.articles;
DROP POLICY IF EXISTS "articles anon read"          ON public.articles;
DROP POLICY IF EXISTS "articles read published"     ON public.articles;
DROP POLICY IF EXISTS "articles select published"   ON public.articles;
DROP POLICY IF EXISTS "Public can view published"   ON public.articles;
DROP POLICY IF EXISTS "Anyone can read articles"    ON public.articles;
DROP POLICY IF EXISTS "articles_select_authenticated_only" ON public.articles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.articles;

CREATE POLICY "articles public read"
  ON public.articles
  FOR SELECT
  TO public
  USING (status IS NULL OR status = 'published');

-- 2) Defensive: re-assert public read on the other content tables that
-- home/section/conversation pages depend on. If RLS got rebuilt on
-- any of them for the same reason, this catches it.

ALTER TABLE public.conversations_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_data public read" ON public.conversations_data;
CREATE POLICY "conversations_data public read"
  ON public.conversations_data
  FOR SELECT
  TO public
  USING (status IS NULL OR status = 'published');

ALTER TABLE public.stories_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_data public read" ON public.stories_data;
CREATE POLICY "stories_data public read"
  ON public.stories_data
  FOR SELECT
  TO public
  USING (status IS NULL OR status = 'published');

NOTIFY pgrst, 'reload schema';
