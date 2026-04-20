-- ═════════════════════════════════════════════════════════════════
-- Phase 4 — Writing rubric: 5th axis "register"
-- ─────────────────────────────────────────────────────────────────
-- Phase 1 rolled up the rubric as (accuracy + lexical_range + cohesion
-- + coherence) / 4. Phase 4 adds `register` as a 5th axis. Rebuilds
-- the aggregator so:
--   • Newer submissions with register → averaged across all 5
--   • Older submissions without register → averaged across 4 (no penalty)
-- Also returns the register score independently so the UI can show it.
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_recent_writing_rubric(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc numeric; v_lex numeric; v_coh1 numeric; v_coh2 numeric; v_reg numeric;
  v_cnt int; v_reg_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('samples', 0); END IF;

  SELECT
    COUNT(*),
    AVG((ai_feedback->'rubric'->>'accuracy')::numeric),
    AVG((ai_feedback->'rubric'->>'lexical_range')::numeric),
    AVG((ai_feedback->'rubric'->>'cohesion')::numeric),
    AVG((ai_feedback->'rubric'->>'coherence')::numeric),
    AVG((ai_feedback->'rubric'->>'register')::numeric),
    COUNT(*) FILTER (WHERE ai_feedback->'rubric' ? 'register')
  INTO v_cnt, v_acc, v_lex, v_coh1, v_coh2, v_reg, v_reg_cnt
  FROM public.user_submissions
  WHERE user_id = v_uid
    AND content_type IN ('writing', 'daily_package')
    AND ai_feedback IS NOT NULL
    AND ai_feedback ? 'rubric'
    AND submitted_at >= (now() - (p_days || ' days')::interval);

  -- If we have enough register samples, roll 5 axes. Otherwise keep the
  -- 4-axis overall so old data isn't falsely dragged down by COALESCE(0).
  DECLARE
    v_overall numeric;
  BEGIN
    IF v_reg_cnt >= 1 AND v_reg IS NOT NULL THEN
      v_overall := (COALESCE(v_acc,0) + COALESCE(v_lex,0) + COALESCE(v_coh1,0)
                  + COALESCE(v_coh2,0) + v_reg) / 5.0;
    ELSE
      v_overall := (COALESCE(v_acc,0) + COALESCE(v_lex,0) + COALESCE(v_coh1,0)
                  + COALESCE(v_coh2,0)) / 4.0;
    END IF;

    RETURN jsonb_build_object(
      'samples',         COALESCE(v_cnt, 0),
      'register_samples',COALESCE(v_reg_cnt, 0),
      'accuracy',        COALESCE(ROUND(v_acc),  0),
      'lexical_range',   COALESCE(ROUND(v_lex),  0),
      'cohesion',        COALESCE(ROUND(v_coh1), 0),
      'coherence',       COALESCE(ROUND(v_coh2), 0),
      'register',        COALESCE(ROUND(v_reg),  0),
      'overall',         COALESCE(ROUND(v_overall), 0)
    );
  END;
END;
$$;

COMMENT ON FUNCTION public.get_recent_writing_rubric(int) IS 'Average rubric subscores from ai_feedback.rubric JSON (5 axes when register data is present; falls back to 4 axes for older submissions)';
