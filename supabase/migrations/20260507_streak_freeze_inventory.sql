-- Streak Freeze: shop-purchased inventory + auto-apply
-- ================================================================
-- Replaces the "1 freeze every 7 days, manual button" model with a
-- consumable inventory the learner buys from the shop. Auto-applied
-- by the home page on a missed-day detection; no UI button anymore.
--
-- New columns / state
--   profiles.freeze_count         int — current inventory
--
-- New shop_item
--   id = 'streak_freeze' — consumable, can_buy_with_coin = true
--
-- New RPCs
--   purchase_streak_freeze(p_qty)  — atomic nyang deduct + freeze_count++
--   consume_streak_freeze(p_for_date) — atomic decrement + notification
--
-- Notification kind
--   add 'streak_freeze_used' to the allowed enum so the bell shows it.

-- ── 1) Inventory column ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS freeze_count int NOT NULL DEFAULT 0;

-- ── 2) Notifications enum extension ────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    'friend_request','friend_accepted','guestbook_post',
    'comment_reply','badge_earned','streak_freeze_used','system'
  ));

-- ── 3) Shop item ───────────────────────────────────────────────
INSERT INTO public.shop_items (
  id, name, slug, description, image_url,
  item_type, coin_price, cash_price,
  is_active, can_buy_with_coin, can_buy_with_cash, is_repeatable,
  sort_order
) VALUES (
  'streak_freeze',
  'Streak Freeze',
  'streak-freeze',
  '하루 학습을 놓쳐도 연속일이 끊기지 않도록 자동으로 사용돼요.',
  '',
  'consumable',
  50,                -- nyang
  0,
  true,
  true,
  false,
  true,
  5                  -- sort near the top of consumables
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      coin_price = EXCLUDED.coin_price,
      is_active = EXCLUDED.is_active,
      is_repeatable = EXCLUDED.is_repeatable;

-- ── 4) Purchase RPC ────────────────────────────────────────────
-- Lives outside the generic `purchase_shop_item` flow because it
-- needs to write to profiles.freeze_count, not shop_purchases. Keeps
-- the inventory schema small (one int column) at the cost of a
-- dedicated RPC.
CREATE OR REPLACE FUNCTION public.purchase_streak_freeze(p_qty int DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_qty  int  := GREATEST(coalesce(p_qty, 1), 1);
  v_unit_price int;
  v_balance int;
  v_total_cost int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  SELECT coin_price INTO v_unit_price
    FROM public.shop_items
   WHERE id = 'streak_freeze' AND is_active = true;
  IF v_unit_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_unavailable');
  END IF;

  v_total_cost := v_unit_price * v_qty;

  SELECT coalesce(coin_balance, 0) INTO v_balance
    FROM public.user_stats WHERE user_id = v_user FOR UPDATE;
  IF v_balance < v_total_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coin', 'need', v_total_cost, 'have', v_balance);
  END IF;

  UPDATE public.user_stats
     SET coin_balance = coin_balance - v_total_cost
   WHERE user_id = v_user;

  -- Upsert profiles row in case it doesn't exist yet (new accounts).
  INSERT INTO public.profiles (id, freeze_count)
    VALUES (v_user, v_qty)
    ON CONFLICT (id) DO UPDATE
      SET freeze_count = public.profiles.freeze_count + v_qty,
          updated_at = now();

  RETURN jsonb_build_object('ok', true, 'qty', v_qty, 'remaining_balance', v_balance - v_total_cost);
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_streak_freeze(int) TO authenticated;

-- ── 5) Auto-consume RPC ────────────────────────────────────────
-- Decrements freeze_count, marks the date as covered, and posts an
-- in-app notification so the learner knows their streak was rescued.
-- Returns ok=false when there's nothing to spend so the client can
-- swallow the call quietly on quiet days.
CREATE OR REPLACE FUNCTION public.consume_streak_freeze(p_for_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_date  date := COALESCE(p_for_date, CURRENT_DATE - 1);
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  SELECT freeze_count INTO v_count
    FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_count IS NULL OR v_count <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_freezes');
  END IF;

  UPDATE public.profiles
     SET freeze_count = freeze_count - 1,
         streak_freeze_used_week = now(),
         updated_at = now()
   WHERE id = v_user;

  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (v_user, 'streak_freeze_used',
      jsonb_build_object('date', to_char(v_date, 'YYYY-MM-DD'), 'remaining', v_count - 1));

  RETURN jsonb_build_object('ok', true, 'date', to_char(v_date, 'YYYY-MM-DD'), 'remaining', v_count - 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_streak_freeze(date) TO authenticated;

-- ── 6) Helper RPC for the home page to ask "do I have any?" ────
CREATE OR REPLACE FUNCTION public.get_freeze_inventory()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT freeze_count FROM public.profiles WHERE id = auth.uid()), 0);
$$;
GRANT EXECUTE ON FUNCTION public.get_freeze_inventory() TO authenticated;
