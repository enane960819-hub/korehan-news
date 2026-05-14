-- article_study_content: add prompt_version column so the cache check
-- in _asLoadContent actually finds previously-saved rows.
--
-- The frontend save (`_asSaveContentToDB`) already includes
-- `prompt_version: 2` in the upsert, with a retry that strips the
-- field if the column doesn't exist. Without the column, the retry
-- branch fires, the row IS persisted, but the version marker is
-- lost. A fallback was added that stamps `questions._v = 2` instead,
-- but JSON serialisation of an Array drops named properties — so
-- `_v` never reaches the database either.
--
-- Net effect: every save succeeded, every read came back with
-- promptV = 0, dbUsable evaluated to false, and every page-load
-- re-paid for a Claude generation per article. This was burning
-- money on cache misses that should have been DB hits.
--
-- Adding the column fixes both branches: the upsert lands the
-- version directly, the read path detects it, and the cache works.

ALTER TABLE public.article_study_content
  ADD COLUMN IF NOT EXISTS prompt_version int NOT NULL DEFAULT 0;

-- Backfill any rows that already have substantial vocab as
-- prompt_version=2 — those were saved by the current AI prompt and
-- shouldn't be re-generated just because the column was missing
-- when they landed.
UPDATE public.article_study_content
   SET prompt_version = 2
 WHERE prompt_version = 0
   AND vocab IS NOT NULL
   AND jsonb_typeof(vocab) = 'array'
   AND jsonb_array_length(vocab) > 0;

NOTIFY pgrst, 'reload schema';
