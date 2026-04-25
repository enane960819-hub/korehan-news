-- ============================================================
-- user_submissions.content_type: allow 'daily_package'
-- Run this in Supabase SQL Editor.
--
-- Why: submitAllWritingsToday() bundles every saved draft (topic
-- writing, article study, dictation, picture description, key
-- expressions, …) into a single row tagged content_type = 'daily_package'
-- so the AI feedback worker reviews the day's work as a unified
-- package. The original CHECK only allowed
-- (writing|article_study|conversation|story), so the submit currently
-- fails with:
--   new row for relation "user_submissions" violates check constraint
--   "user_submissions_content_type_check"
-- This migration drops the old constraint and re-adds it with
-- 'daily_package' included.
-- ============================================================

ALTER TABLE public.user_submissions
  DROP CONSTRAINT IF EXISTS user_submissions_content_type_check;

ALTER TABLE public.user_submissions
  ADD CONSTRAINT user_submissions_content_type_check
  CHECK (content_type IN (
    'writing',           -- Study Room daily topic writing
    'article_study',     -- Article Study step5 free writing
    'conversation',      -- Conversation lesson writing
    'story',             -- Story lesson writing
    'daily_package'      -- Unified daily bundle (Submit All)
  ));
