-- article_cache: add expressions / updated_at / created_at columns
-- ================================================================
-- The wide-schema article_cache rows in production were missing these
-- columns, which caused silent write failures during the bulk-gen
-- ('all ✗' bug, costs doubling). This patches the schema in-place,
-- idempotent so it can be re-run.
--
-- Run order doesn't matter relative to the other 20260506/07 SQLs.

ALTER TABLE public.article_cache
  ADD COLUMN IF NOT EXISTS expressions jsonb,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Update updated_at automatically on row writes so the admin can
-- see when each cache slice was last refreshed.
CREATE OR REPLACE FUNCTION public._touch_article_cache_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_article_cache_touch ON public.article_cache;
CREATE TRIGGER trg_article_cache_touch
  BEFORE UPDATE ON public.article_cache
  FOR EACH ROW EXECUTE FUNCTION public._touch_article_cache_updated_at();
