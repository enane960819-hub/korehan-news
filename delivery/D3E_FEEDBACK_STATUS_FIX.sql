-- =============================================================================
-- D3E — mark_feedback_viewed status gate fix
-- =============================================================================
-- The original D3B_FEEDBACK_VIEW_REWARD.sql gated the XP award on
-- status IN ('reviewed','admin_approved','sent'). 'reviewed' is not a
-- valid status (CHECK constraint allows only submitted | ai_reviewed |
-- admin_approved | sent), so any submission processed by the AI feedback
-- path (which sets ai_reviewed) was excluded. Result: every call returned
-- NO_FEEDBACK_YET, no XP, no streak credit.
--
-- This migration replaces the RPC with the correct gate. Idempotent.

CREATE OR REPLACE FUNCTION mark_feedback_viewed(p_submission_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_status  TEXT;
  v_viewed  TIMESTAMPTZ;
  v_awarded BOOLEAN := FALSE;
  v_xp      INT := 5;
  v_date    DATE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT status, feedback_viewed_at
    INTO v_status, v_viewed
  FROM user_submissions
  WHERE id = p_submission_id AND user_id = v_uid;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_FOUND');
  END IF;

  -- AI-generated, admin-approved, and delivered states all qualify as
  -- "feedback available to read." Matches the CHECK constraint on
  -- user_submissions.status defined in 20260404_user_submissions.sql.
  IF v_status NOT IN ('ai_reviewed','admin_approved','sent') THEN
    RETURN jsonb_build_object('ok', TRUE, 'awarded', FALSE, 'xp', 0, 'reason', 'NO_FEEDBACK_YET');
  END IF;

  IF v_viewed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'awarded', FALSE, 'xp', 0);
  END IF;

  UPDATE user_submissions
    SET feedback_viewed_at = NOW()
    WHERE id = p_submission_id AND user_id = v_uid;

  INSERT INTO user_stats (user_id, xp)
    VALUES (v_uid, v_xp)
    ON CONFLICT (user_id) DO UPDATE SET xp = user_stats.xp + v_xp;

  v_date := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  BEGIN
    INSERT INTO daily_missions (user_id, date, articles, words, quizzes, fill, feedback_views)
      VALUES (v_uid, v_date, 0, 0, 0, 0, 1)
      ON CONFLICT (user_id, date) DO UPDATE
        SET feedback_views = COALESCE(daily_missions.feedback_views, 0) + 1;
  EXCEPTION WHEN undefined_column THEN
    ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS feedback_views INT NOT NULL DEFAULT 0;
    INSERT INTO daily_missions (user_id, date, articles, words, quizzes, fill, feedback_views)
      VALUES (v_uid, v_date, 0, 0, 0, 0, 1)
      ON CONFLICT (user_id, date) DO UPDATE
        SET feedback_views = COALESCE(daily_missions.feedback_views, 0) + 1;
  WHEN undefined_table THEN
    NULL;
  END;

  v_awarded := TRUE;
  RETURN jsonb_build_object('ok', TRUE, 'awarded', v_awarded, 'xp', v_xp);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_feedback_viewed(BIGINT) TO authenticated;
