-- The articles list/feed selects (js/core/articles.js) and the admin
-- importer (korehan-x9f4k2m7.html) both reference `articles.source_url`,
-- but the column was never created in any migration. The result was a
-- 400 Bad Request on every page that runs a list fetch:
--   GET .../articles?select=id,title,...,source_url
--   → column articles.source_url does not exist
--
-- Add the column idempotently. The admin importer stores the upstream
-- article URL (reddit permalink, news source URL, etc.) here, and the
-- reader uses it to deep-link out / extract reddit video metadata.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS source_url text;

CREATE INDEX IF NOT EXISTS articles_source_url_idx
  ON public.articles (source_url)
  WHERE source_url IS NOT NULL;

-- Refresh PostgREST schema cache so REST sees the new column without
-- a service restart.
NOTIFY pgrst, 'reload schema';
