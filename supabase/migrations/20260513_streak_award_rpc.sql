-- Creates the `claim_streak_award(p_streak integer)` RPC the frontend
-- calls from korehan-shared.js khClaimStreakAward to grant streak-
-- milestone rewards (freeze inventory bumps every 3-day streak).
--
-- Symptom this fixes (console, signed-in home/article/conv pages):
--   POST /rest/v1/rpc/claim_streak_award → 400 Bad Request
--
-- The frontend currently latches `window._khClaimAwardBroken = true`
-- on the first 400 in a tab so we don't keep hitting it; until this
-- RPC exists with the right signature the streak-award feature is
-- a no-op (user keeps the streak count but doesn't get the freeze
-- credit), which is degraded but not broken.
--
-- Schema assumptions (please verify against your prod schema before
-- applying):
--   profiles.id (uuid pk)
--   profiles.freeze_count (int, default 0) — used by khFreezeStatus
--   profiles.last_award_streak (int, default 0) — high-water mark so
--     repeats resolve to {awarded:0}
--   notifications(user_id, kind, payload, created_at) — popped into
--     the bell when awarded > 0

CREATE OR REPLACE FUNCTION public.claim_streak_award(p_streak integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_prev_high int  := 0;
  v_awarded   int  := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', 0, 'error', 'not_signed_in');
  END IF;
  IF p_streak IS NULL OR p_streak < 3 THEN
    RETURN jsonb_build_object('awarded', 0);
  END IF;

  -- High-water mark: how many 3-day milestones have we already paid
  -- out? Each new "complete 3 days" tier grants +1 freeze, capped at
  -- 3 in inventory.
  SELECT COALESCE(last_award_streak, 0) INTO v_prev_high
  FROM public.profiles WHERE id = v_uid;

  v_awarded := GREATEST(0, (p_streak / 3) - (v_prev_high / 3));

  IF v_awarded > 0 THEN
    UPDATE public.profiles
       SET freeze_count       = LEAST(COALESCE(freeze_count, 0) + v_awarded, 3),
           last_award_streak  = p_streak
     WHERE id = v_uid;

    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (
      v_uid,
      'streak_award',
      jsonb_build_object('streak', p_streak, 'awarded', v_awarded)
    );
  END IF;

  RETURN jsonb_build_object('awarded', v_awarded, 'streak', p_streak);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_streak_award(integer) TO authenticated;

-- Verification:
--   SELECT public.claim_streak_award(3);   -- as a signed-in user
--   -- should return {"awarded":1,"streak":3} the first time, then
--   -- {"awarded":0,"streak":3} on every subsequent call.
