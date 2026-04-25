-- ============================================================
-- article_study_content: wrong_phrases for the bonus comprehension quiz
-- Run this in Supabase SQL Editor.
--
-- Why: the article-study bonus quiz used to synthesise wrong-answer
-- distractors at runtime by gluing vocab words together
-- ('vocab.ko + 를 + vocab[0].ko + 했어요'), which produced obvious
-- nonsense like '재료를 반려동물 했어요'. We now ask the AI to author
-- plausible-but-false sentences alongside the true phrases, persist
-- them per article, and let admins edit them. The bonus quiz reads
-- this column directly; if it's empty the quiz is hidden rather than
-- showing fabricated garbage.
-- ============================================================

ALTER TABLE public.article_study_content
  ADD COLUMN IF NOT EXISTS wrong_phrases jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.article_study_content.wrong_phrases IS
  'Plausible-but-false sentences used as distractors in the bonus comprehension quiz. Shape: [{ko, en}, ...]. Empty array = bonus quiz hidden.';
