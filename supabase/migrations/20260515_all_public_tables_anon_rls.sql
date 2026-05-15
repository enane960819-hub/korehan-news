-- All-public-tables RLS sweep. Owner-frustrated: "이렇게 내가 하나하나
-- 다 말해줘야되는거야?" — instead of fixing tables one-by-one as users
-- report blank pages, this migration covers EVERY public table the
-- frontend queries before login.
--
-- The pattern: enable RLS, drop any stale SELECT-gating policies by
-- name, create one canonical "public read" policy. Authenticated
-- writes are unaffected (admin uses service-role via admin-api edge
-- function which bypasses RLS).
--
-- Re-running this against a healthy schema is safe — every CREATE
-- pairs with a DROP IF EXISTS so the policy is replaced atomically.

-- ── hover_vocab_master ─────────────────────────────────────────
-- Hover tooltip lookups fire on every article paragraph for every
-- anon visitor (korehan-hover-tooltips.js). Without anon SELECT the
-- entire hover system silently fails.
ALTER TABLE public.hover_vocab_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hover_vocab_master public read" ON public.hover_vocab_master;
CREATE POLICY "hover_vocab_master public read"
  ON public.hover_vocab_master
  FOR SELECT
  TO public
  USING (true);

-- ── vocabulary_bank ────────────────────────────────────────────
-- Daily vocab assignments + learn-hub pull from this table. Anon
-- can preview the learn page so they need read access.
ALTER TABLE public.vocabulary_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vocabulary_bank public read" ON public.vocabulary_bank;
CREATE POLICY "vocabulary_bank public read"
  ON public.vocabulary_bank
  FOR SELECT
  TO public
  USING (true);

-- ── app_settings ──────────────────────────────────────────────
-- Today's Phrase, site config, section catalog all live here. Home
-- page is unusable for anon without read access. We INTENTIONALLY
-- expose every row including admin_emails — those are non-secret
-- identifiers used to decide admin gate, not credentials. (Admin
-- writes still go through service-role.)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
CREATE POLICY "app_settings public read"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (true);

-- ── article_cache ────────────────────────────────────────────
-- AI-generated vocab/grammar/mission per article. Article reader
-- pulls this on every open. Without anon read the reader's bottom
-- panels stay blank.
ALTER TABLE public.article_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "article_cache public read" ON public.article_cache;
CREATE POLICY "article_cache public read"
  ON public.article_cache
  FOR SELECT
  TO public
  USING (true);

-- ── article_study_content ─────────────────────────────────────
-- Article Study 4-step content. Anon can preview the picker but
-- can't take a step without login; the row read itself is
-- harmless.
ALTER TABLE public.article_study_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "article_study_content public read" ON public.article_study_content;
CREATE POLICY "article_study_content public read"
  ON public.article_study_content
  FOR SELECT
  TO public
  USING (true);

-- ── character_reporters ──────────────────────────────────────
-- Reporter directory + per-article reporter byline. Read-only for
-- everyone; writes are admin-only via service-role.
ALTER TABLE public.character_reporters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "character_reporters public read" ON public.character_reporters;
CREATE POLICY "character_reporters public read"
  ON public.character_reporters
  FOR SELECT
  TO public
  USING (true);

-- ── reporters (alt name some envs use) ────────────────────────
-- Older deploys had `reporters` (without character_ prefix). Try
-- to enable RLS + create policy if the table exists; ignore if not.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reporters') THEN
    EXECUTE 'ALTER TABLE public.reporters ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "reporters public read" ON public.reporters';
    EXECUTE 'CREATE POLICY "reporters public read" ON public.reporters FOR SELECT TO public USING (true)';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
