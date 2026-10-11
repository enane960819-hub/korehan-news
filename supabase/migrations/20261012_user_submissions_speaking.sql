-- auto-apply
-- user_submissions.content_type: allow 'speaking'.
-- The Study Room's free AI speaking path (submitSpeaking) inserts
-- content_type='speaking', but the CHECK constraint never listed it, so
-- those submissions were rejected. NOT VALID so any legacy row can't block
-- the change; new rows are checked. Idempotent.
ALTER TABLE public.user_submissions
  DROP CONSTRAINT IF EXISTS user_submissions_content_type_check;
ALTER TABLE public.user_submissions
  ADD CONSTRAINT user_submissions_content_type_check
  CHECK (content_type IN (
    'writing', 'article_study', 'conversation', 'story', 'daily_package',
    'speaking'           -- Study Room speaking practice (AI feedback)
  )) NOT VALID;
