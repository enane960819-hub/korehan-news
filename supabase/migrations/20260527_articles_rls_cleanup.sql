-- ═════════════════════════════════════════════════════════════════════
-- articles RLS cleanup + status NOT NULL + (created_at DESC) index
-- ═════════════════════════════════════════════════════════════════════
-- The articles table had THREE overlapping SELECT-allowing policies:
--
--   1. "admin manages articles"           ALL,  auth.email()=admin
--   2. "anyone reads published articles"  SELECT, status='published' OR admin
--   3. "articles public read"             SELECT, status IS NULL OR 'published'
--
-- They union via OR, so the effective rule was: admin sees all + anyone
-- reads (status IS NULL OR 'published'). The (status IS NULL) clause
-- was dead in practice (current 359 rows: 338 published + 21 draft,
-- zero NULL) but it WAS a latent hole — any future INSERT that passed
-- status=NULL explicitly would have been visible to anon.
--
-- 24 ms Planning Time on EXPLAIN ANALYZE was driven mostly by the
-- 5-OR filter PostgreSQL had to evaluate from the merged policies.
--
-- Cleanup:
--   - DROP the two redundant SELECT policies
--   - ADD one clean policy: anon/auth SELECT status='published'
--   - KEEP "admin manages articles" unchanged (covers admin SELECT via ALL)
--   - SET status NOT NULL (current rows are all set; safe)
--   - ADD index articles(created_at DESC) for the home rail Sort step

-- ─── RLS dedup ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anyone reads published articles" ON public.articles;
DROP POLICY IF EXISTS "articles public read" ON public.articles;

DROP POLICY IF EXISTS "articles published read" ON public.articles;
CREATE POLICY "articles published read"
ON public.articles
FOR SELECT TO anon, authenticated
USING (status = 'published');

-- ─── status NOT NULL (defense in depth — current rows are all set) ──

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM articles WHERE status IS NULL) THEN
    RAISE EXCEPTION 'Cannot SET NOT NULL: % rows have status IS NULL — fix data first',
      (SELECT count(*) FROM articles WHERE status IS NULL);
  END IF;
END $$;

ALTER TABLE public.articles
  ALTER COLUMN status SET NOT NULL;

-- ─── Index for home rail ORDER BY ──────────────────────────────────
-- Tiny gain at current 359 rows (Sort completes in 0.5 ms), but
-- future-proofs the home rail as the table grows. Covers the most
-- common access pattern: latest published articles.

CREATE INDEX IF NOT EXISTS idx_articles_created_at_desc
  ON public.articles (created_at DESC)
  WHERE status = 'published';

COMMENT ON INDEX public.idx_articles_created_at_desc IS
  'Home rail ORDER BY created_at DESC, partial on status=published since draft rows are never listed by anon.';
