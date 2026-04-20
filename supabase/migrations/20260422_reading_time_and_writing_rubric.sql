-- ═════════════════════════════════════════════════════════════════
-- Phase 1 — Reading time (WPM) + Writing rubric
-- ─────────────────────────────────────────────────────────────────
-- Extends existing surfaces instead of adding new tables:
--
--   • user_read_history.read_seconds  — populated when the reader
--     closes the article. WPM is computed client-side from the
--     article word count. Feeds the Learning Hub Reading axis.
--
--   • finish_read_event RPC — called on reader exit. Marks the most
--     recent row complete and stamps read_seconds atomically.
--
--   • Writing rubric lives INSIDE the existing user_submissions.ai_feedback
--     JSON (new keys: rubric.accuracy / lexical_range / cohesion /
--     coherence). No new column is needed — JSON already holds the
--     Claude response. A GENERATED COLUMN exposes the rubric average
--     for cheap aggregation in the Learning Hub writing axis.
-- ═════════════════════════════════════════════════════════════════

-- 1) Reading elapsed time on user_read_history
ALTER TABLE public.user_read_history
  ADD COLUMN IF NOT EXISTS read_seconds int;

-- 2) finish_read_event — call with exactly the same (content_type,
--    content_id) pair the open-time log_read_event used. Stamps the
--    elapsed time + completion on the most recent matching row.
CREATE OR REPLACE FUNCTION public.finish_read_event(
  p_content_type text,
  p_content_id   text,
  p_read_seconds int,
  p_word_count   int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_read_seconds IS NULL OR p_read_seconds < 0 THEN p_read_seconds := 0; END IF;
  -- Cap absurd dwell times (tab left open for hours) to 30 min so
  -- the average WPM isn't pulled toward zero by idle sessions.
  IF p_read_seconds > 1800 THEN p_read_seconds := 1800; END IF;

  SELECT id INTO v_id
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = p_content_type
      AND content_id   = p_content_id
    ORDER BY read_at DESC
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_event');
  END IF;

  UPDATE public.user_read_history
    SET read_seconds = GREATEST(COALESCE(read_seconds, 0), p_read_seconds),
        word_count   = COALESCE(p_word_count, word_count),
        completed    = true
    WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'read_seconds', p_read_seconds);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) FROM public;
GRANT  EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) TO authenticated;

-- 3) Quick aggregation helper — avg WPM from recent completed reads.
--    Used by the Learning Hub reading-axis scorer.
CREATE OR REPLACE FUNCTION public.get_recent_wpm(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_avg numeric;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('wpm', 0, 'samples', 0); END IF;

  SELECT COUNT(*), AVG(word_count::numeric / NULLIF(read_seconds, 0) * 60)
    INTO v_cnt, v_avg
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = 'article'
      AND completed = true
      AND read_seconds IS NOT NULL
      AND read_seconds >= 10      -- Ignore bounces
      AND word_count   IS NOT NULL
      AND word_count   > 20
      AND read_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'wpm',     COALESCE(ROUND(v_avg), 0),
    'samples', COALESCE(v_cnt, 0)
  );
END;
$$;

-- Needs word_count on user_read_history; add if missing.
ALTER TABLE public.user_read_history
  ADD COLUMN IF NOT EXISTS word_count int;

REVOKE EXECUTE ON FUNCTION public.get_recent_wpm(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_wpm(int) TO authenticated;

-- 4) Writing rubric aggregation — averages the rubric subscores
--    stored inside user_submissions.ai_feedback JSON over the last N
--    days of AI-reviewed writings. Returns 0 if the user hasn't
--    submitted anything, letting the Learning Hub gracefully fall
--    back to its old count-based heuristic.
CREATE OR REPLACE FUNCTION public.get_recent_writing_rubric(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc numeric; v_lex numeric; v_coh1 numeric; v_coh2 numeric;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('samples', 0); END IF;

  SELECT
    COUNT(*),
    AVG((ai_feedback->'rubric'->>'accuracy')::numeric),
    AVG((ai_feedback->'rubric'->>'lexical_range')::numeric),
    AVG((ai_feedback->'rubric'->>'cohesion')::numeric),
    AVG((ai_feedback->'rubric'->>'coherence')::numeric)
  INTO v_cnt, v_acc, v_lex, v_coh1, v_coh2
  FROM public.user_submissions
  WHERE user_id = v_uid
    AND content_type = 'writing'
    AND ai_feedback IS NOT NULL
    AND ai_feedback ? 'rubric'
    AND submitted_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'samples',       COALESCE(v_cnt, 0),
    'accuracy',      COALESCE(ROUND(v_acc), 0),
    'lexical_range', COALESCE(ROUND(v_lex), 0),
    'cohesion',      COALESCE(ROUND(v_coh1), 0),
    'coherence',     COALESCE(ROUND(v_coh2), 0),
    'overall',       COALESCE(ROUND((v_acc + v_lex + v_coh1 + v_coh2) / 4.0), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_recent_writing_rubric(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_writing_rubric(int) TO authenticated;

COMMENT ON FUNCTION public.finish_read_event(text, text, int) IS 'Called on reader close — stamps read_seconds + completed on the most recent open event';
COMMENT ON FUNCTION public.get_recent_wpm(int)                IS 'Average WPM over recent completed article reads (feeds Reading axis)';
COMMENT ON FUNCTION public.get_recent_writing_rubric(int)     IS 'Average rubric subscores from ai_feedback.rubric JSON (feeds Writing axis)';
