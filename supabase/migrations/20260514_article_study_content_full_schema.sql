-- article_study_content: ensure every column the frontend writes is
-- present. The save path was silently rolling back whenever any one
-- column was missing — owner-reported article_study_content was 0 rows
-- in production despite weeks of learner traffic.
--
-- Migrations 20260402 (initial create), 20260424 (wrong_phrases),
-- 20260514 (prompt_version) each added a subset. Production may have
-- received some but not others. This migration is the union — adds
-- whatever's missing, idempotently, so the save path stops failing.

ALTER TABLE public.article_study_content
  ADD COLUMN IF NOT EXISTS vocab          jsonb     DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phrases        jsonb     DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wrong_phrases  jsonb     DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS word_order     jsonb     DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS questions      jsonb     DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_highlights jsonb,
  ADD COLUMN IF NOT EXISTS admin_edited   boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_version int       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

-- Backfill prompt_version for any existing row that has substantive
-- vocab — those were saved by the current AI prompt and shouldn't
-- be re-generated just because the version stamp wasn't recorded.
UPDATE public.article_study_content
   SET prompt_version = 2
 WHERE prompt_version = 0
   AND vocab IS NOT NULL
   AND jsonb_typeof(vocab) = 'array'
   AND jsonb_array_length(vocab) > 0;

NOTIFY pgrst, 'reload schema';
