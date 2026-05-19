-- =============================================================================
-- D3O — mark_feedback_viewed: gate on admin-reviewed only
-- =============================================================================
-- D3E erroneously included 'ai_reviewed' in the qualifying status set.
-- The actual product flow is:
--    submitted  →  ai_reviewed  →  admin_approved  →  sent
--                  (internal      (visible to user)
--                   AI draft for
--                   admin queue)
--
-- Users should not earn the +5 XP "viewed your feedback" reward — nor
-- should the home pill / My Page chip surface — until a tutor has
-- actually reviewed and approved the feedback. AI drafts are an
-- intermediate state for the admin queue, not consumer state.
--
-- This migration replaces the RPC with the corrected gate. Idempotent.

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

  -- Admin-approved or sent only. ai_reviewed is the AI draft sitting
  -- in the admin queue — the tutor hasn't approved it yet, so the
  -- user shouldn't be rewarded for "viewing" pre-tutor work.
  IF v_status NOT IN ('admin_approved','sent') THEN
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
