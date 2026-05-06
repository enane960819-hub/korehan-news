-- Streak Freeze (revised): awarded for 3-day attendance, not bought
-- ================================================================
-- Supersedes 20260507_streak_freeze_inventory.sql's shop-purchase
-- model. Per the product owner: every 3 consecutive days of streak
-- grants one freeze, capped at 3 in inventory. Auto-applied on a
-- missed day. The shop item is retired.
--
-- This file is additive — keeps the freeze_count column and the
-- consume_streak_freeze RPC from the prior migration, drops the
-- shop seed, and adds the new claim_streak_award RPC + tracking
-- column + 'streak_freeze_awarded' notification kind.

-- ── 1) Track the highest streak we've already awarded for ──────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_freeze_award_streak int NOT NULL DEFAULT 0;

-- ── 2) Notifications enum: add the 'awarded' kind ──────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    'friend_request','friend_accepted','guestbook_post',
    'comment_reply','badge_earned',
    'streak_freeze_used','streak_freeze_awarded',
    'system'
  ));

-- ── 3) Retire the shop item ────────────────────────────────────
-- Was seeded by the prior migration as a 50-nyang consumable. The
-- new contract gives freezes for free as a streak reward, so the
-- shop SKU just disappears (is_active=false keeps any historical
-- references intact while hiding it from the storefront).
UPDATE public.shop_items
   SET is_active = false
 WHERE id = 'streak_freeze';

-- ── 4) Award RPC ───────────────────────────────────────────────
-- Called from the home page after the client computes the current
-- streak. Awards FLOOR((streak - last_award) / 3) freezes per call,
-- capped so the user never holds more than 3 at once. Idempotent on
-- repeated calls inside the same streak run because last_freeze_
-- award_streak advances after each award.
CREATE OR REPLACE FUNCTION public.claim_streak_award(p_streak int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_last      int;
  v_count     int;
  v_eligible  int;
  v_award     int;
  v_inventory_cap constant int := 3;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_streak IS NULL OR p_streak < 3 THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0);
  END IF;

  -- Make sure the row exists, then read current inventory + tracker.
  INSERT INTO public.profiles (id) VALUES (v_user) ON CONFLICT (id) DO NOTHING;
  SELECT coalesce(last_freeze_award_streak, 0), coalesce(freeze_count, 0)
    INTO v_last, v_count
    FROM public.profiles WHERE id = v_user FOR UPDATE;

  -- 3-day cycles since the last award.
  v_eligible := GREATEST(0, FLOOR((p_streak - v_last) / 3.0))::int;
  IF v_eligible <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'remaining', v_count);
  END IF;
  -- Cap by current free inventory slots.
  v_award := LEAST(v_eligible, GREATEST(0, v_inventory_cap - v_count));
  -- Always advance the tracker so we don't keep paying out for the
  -- same days even if the cap held us back. The next time the cap
  -- frees up the user has to add another 3 active days.
  UPDATE public.profiles
     SET freeze_count = freeze_count + v_award,
         last_freeze_award_streak = p_streak,
         updated_at = now()
   WHERE id = v_user;

  IF v_award > 0 THEN
    INSERT INTO public.notifications (user_id, kind, payload)
      VALUES (v_user, 'streak_freeze_awarded',
        jsonb_build_object('granted', v_award, 'streak', p_streak, 'remaining', v_count + v_award));
  END IF;

  RETURN jsonb_build_object('ok', true, 'awarded', v_award, 'remaining', v_count + v_award, 'capped', v_eligible > v_award);
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_streak_award(int) TO authenticated;
