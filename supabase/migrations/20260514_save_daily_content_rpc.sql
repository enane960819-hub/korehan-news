-- Daily content gen: let the FIRST authenticated user persist what
-- they generated, so subsequent users hit the DB instead of paying
-- for another Claude call.
--
-- The 20260507 RLS lockdown restricted study_daily_content writes to
-- the admin email. That blocked the client-side fallback that
-- _generateAndSaveDailyContent fires when no row exists for today
-- (cron / admin pre-bake didn't happen). Result: every learner who
-- opens the Study Room before admin pre-baked triggered their own
-- Claude call AND the upsert silently failed under RLS, so the next
-- learner did the same. Cost-wise: 4 levels × N learners × $0.04 per
-- gen — burning hundreds of dollars on duplicate generations.
--
-- This RPC runs as SECURITY DEFINER so it bypasses RLS for the
-- INSERT, but the function gates the write itself: it ONLY upserts
-- when no row exists for (date, level) yet, OR the existing row has
-- empty vocab. Admin-edited rows (admin_edited = true) are NEVER
-- overwritten — those are the curated overrides.
--
-- Surface area is intentionally narrow: only the topic + the seven
-- learning JSONB columns. status is hard-coded to 'approved' because
-- the client-gen path is downstream of admin approval (admin can
-- still edit later, and admin_edited stays false so future re-gens
-- are allowed if the row was AI-only).

CREATE OR REPLACE FUNCTION public.save_daily_content_if_missing(
  p_date                date,
  p_level               text,
  p_topic_ko            text,
  p_topic_en            text,
  p_vocab               jsonb,
  p_grammar             jsonb,
  p_helpers             jsonb,
  p_dictation_sentences jsonb,
  p_dictation_questions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_admin_edited boolean;
  v_existing_vocab        jsonb;
  v_was_inserted          boolean := false;
BEGIN
  -- Reject anonymous calls — must be a signed-in learner.
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  -- Sanity-cap the payload sizes so a malformed or runaway client
  -- can't dump huge blobs into the table.
  IF coalesce(length(p_topic_ko), 0) > 400
     OR coalesce(length(p_topic_en), 0) > 400 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'topic_too_long');
  END IF;
  IF jsonb_typeof(p_vocab) <> 'array' OR jsonb_array_length(p_vocab) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'vocab_invalid_or_too_long');
  END IF;
  IF jsonb_typeof(p_grammar) <> 'array' OR jsonb_array_length(p_grammar) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'grammar_invalid_or_too_long');
  END IF;

  -- Look up the existing row (if any) so we can decide whether to
  -- write. Two skip conditions:
  --   1. Row exists AND admin_edited = true — never clobber admin work.
  --   2. Row exists AND already has non-empty vocab — first-writer-wins
  --      per (date, level), so concurrent learners don't keep racing.
  SELECT admin_edited, vocab
    INTO v_existing_admin_edited, v_existing_vocab
    FROM public.study_daily_content
   WHERE scheduled_date = p_date AND level = p_level;

  IF v_existing_admin_edited = true THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'admin_edited');
  END IF;

  IF v_existing_vocab IS NOT NULL
     AND jsonb_typeof(v_existing_vocab) = 'array'
     AND jsonb_array_length(v_existing_vocab) > 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'already_filled');
  END IF;

  -- INSERT … ON CONFLICT so a true race between two simultaneous
  -- generators still resolves cleanly (the loser's vocab/grammar lose
  -- to the winner's, but neither errors).
  INSERT INTO public.study_daily_content (
    scheduled_date, level,
    topic_ko, topic_en,
    vocab, grammar, helpers,
    dictation_sentences, dictation_questions,
    admin_edited, updated_at
  )
  VALUES (
    p_date, p_level,
    coalesce(p_topic_ko, ''), coalesce(p_topic_en, ''),
    p_vocab, p_grammar, coalesce(p_helpers, '[]'::jsonb),
    coalesce(p_dictation_sentences, '[]'::jsonb),
    coalesce(p_dictation_questions, '[]'::jsonb),
    false, now()
  )
  ON CONFLICT (scheduled_date, level) DO UPDATE
    SET topic_ko            = EXCLUDED.topic_ko,
        topic_en            = EXCLUDED.topic_en,
        vocab               = EXCLUDED.vocab,
        grammar             = EXCLUDED.grammar,
        helpers             = EXCLUDED.helpers,
        dictation_sentences = EXCLUDED.dictation_sentences,
        dictation_questions = EXCLUDED.dictation_questions,
        updated_at          = now()
   WHERE public.study_daily_content.admin_edited = false
     AND (public.study_daily_content.vocab IS NULL
          OR jsonb_typeof(public.study_daily_content.vocab) <> 'array'
          OR jsonb_array_length(public.study_daily_content.vocab) = 0);

  v_was_inserted := true;
  RETURN jsonb_build_object('ok', true, 'inserted', v_was_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_daily_content_if_missing(
  date, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) TO authenticated;

NOTIFY pgrst, 'reload schema';
