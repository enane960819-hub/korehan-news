-- =============================================================================
-- Item 3B — feedback-view XP reward
-- =============================================================================
-- The audit flagged a momentum gap: writing/speaking XP is awarded at
-- submit time. When admin feedback arrives 24h later it triggers no new
-- signal, so users have no in-app incentive to actually open and read
-- their feedback. This migration rewards the opening step itself —
-- +5 XP the first time a user views a reviewed submission, plus a small
-- bump on the daily_missions counter so feedback-receipt counts toward
-- the activity streak (closing the dead-loop the audit also flagged).
--
-- Idempotent. Safe to re-run.

ALTER TABLE user_submissions
  ADD COLUMN IF NOT EXISTS feedback_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_submissions_unviewed_idx
  ON user_submissions (user_id)
  WHERE feedback_viewed_at IS NULL
    AND status IN ('reviewed','admin_approved','sent');

-- =============================================================================
-- mark_feedback_viewed — idempotent first-view marker + XP grant
-- =============================================================================
-- Returns { ok, awarded: bool, xp: int }. Calling again on an already-
-- viewed row is a no-op (awarded=false), so the client can call this
-- every time the user expands the card without worrying about double
-- awarding.

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

  -- Ownership check + grab current state.
  SELECT status, feedback_viewed_at
    INTO v_status, v_viewed
  FROM user_submissions
  WHERE id = p_submission_id AND user_id = v_uid;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_FOUND');
  END IF;

  -- Only count it when there's actually feedback ready.
  IF v_status NOT IN ('reviewed','admin_approved','sent') THEN
    RETURN jsonb_build_object('ok', TRUE, 'awarded', FALSE, 'xp', 0, 'reason', 'NO_FEEDBACK_YET');
  END IF;

  -- Already viewed → idempotent no-op.
  IF v_viewed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'awarded', FALSE, 'xp', 0);
  END IF;

  -- First view: stamp it, award XP via user_stats, bump daily activity.
  UPDATE user_submissions
    SET feedback_viewed_at = NOW()
    WHERE id = p_submission_id AND user_id = v_uid;

  -- user_stats.xp bump. If the row doesn't exist yet (rare for active
  -- users but possible for fresh accounts), upsert it.
  INSERT INTO user_stats (user_id, xp)
    VALUES (v_uid, v_xp)
    ON CONFLICT (user_id) DO UPDATE SET xp = user_stats.xp + v_xp;

  -- daily_missions activity flag — feedback-receipt now counts as a
  -- daily activity. Streak system reads daily_missions to compute the
  -- consecutive-day count, so reading feedback on an otherwise-blank
  -- day still keeps the streak alive.
  v_date := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  BEGIN
    INSERT INTO daily_missions (user_id, date, articles, words, quizzes, fill, feedback_views)
      VALUES (v_uid, v_date, 0, 0, 0, 0, 1)
      ON CONFLICT (user_id, date) DO UPDATE
        SET feedback_views = COALESCE(daily_missions.feedback_views, 0) + 1;
  EXCEPTION WHEN undefined_column THEN
    -- Older deploys may lack daily_missions.feedback_views; add it.
    ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS feedback_views INT NOT NULL DEFAULT 0;
    INSERT INTO daily_missions (user_id, date, articles, words, quizzes, fill, feedback_views)
      VALUES (v_uid, v_date, 0, 0, 0, 0, 1)
      ON CONFLICT (user_id, date) DO UPDATE
        SET feedback_views = COALESCE(daily_missions.feedback_views, 0) + 1;
  WHEN undefined_table THEN
    -- daily_missions absent in this env — silently skip the streak nudge.
    NULL;
  END;

  v_awarded := TRUE;
  RETURN jsonb_build_object('ok', TRUE, 'awarded', v_awarded, 'xp', v_xp);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_feedback_viewed(BIGINT) TO authenticated;

-- Add the column up-front too so the EXCEPTION branch above is only a
-- belt-and-suspenders fallback for environments running the RPC ahead
-- of the explicit ALTER.
ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS feedback_views INT NOT NULL DEFAULT 0;
