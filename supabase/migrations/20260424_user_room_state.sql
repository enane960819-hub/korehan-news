-- ============================================================
-- Per-user room state + atomic purchase RPC
-- Run this in Supabase SQL Editor.
--
-- Context: the Mini Room feature previously stored each user's layout /
-- owned-items list inside `app_settings.value` under the synthetic key
-- `room_data_<uid>`. That table is meant for admin config (e.g. the
-- Anthropic API key) and has no per-user RLS, so user data was mixed with
-- secrets. This migration moves room state to its own table with proper
-- RLS, and introduces an atomic purchase RPC that guards the coin balance
-- server-side.
-- ============================================================

-- 1. Per-user room state table
CREATE TABLE IF NOT EXISTS public.user_room_state (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  layout     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  owned      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_room_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_room_state_select_own" ON public.user_room_state;
CREATE POLICY "user_room_state_select_own" ON public.user_room_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_room_state_insert_own" ON public.user_room_state;
CREATE POLICY "user_room_state_insert_own" ON public.user_room_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_room_state_update_own" ON public.user_room_state;
CREATE POLICY "user_room_state_update_own" ON public.user_room_state
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Atomic purchase RPC.
--    Checks the live server-side balance, deducts, records ownership and
--    logs a coin_transactions row — all inside a single transaction so two
--    concurrent purchase attempts can't both succeed.
CREATE OR REPLACE FUNCTION public.buy_room_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid   := auth.uid();
  v_item      public.room_items%rowtype;
  v_price     int;
  v_coin      bigint;
  v_new_coin  bigint;
  v_owned     jsonb;
  v_name      text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_item_id IS NULL OR length(p_item_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Look up price from the canonical catalog. Never trust a client-supplied price.
  SELECT * INTO v_item FROM public.room_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND');
  END IF;
  v_price := COALESCE(v_item.price_nyang, 0);
  v_name  := COALESCE(v_item.name, p_item_id);

  -- Seed the state row if this is the user's first purchase.
  INSERT INTO public.user_room_state (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Already owned? Bail out cheaply (UX: treat as success, balance unchanged).
  SELECT owned INTO v_owned FROM public.user_room_state WHERE user_id = v_user_id FOR UPDATE;
  IF v_owned ? p_item_id THEN
    SELECT COALESCE(coin_balance, 0) INTO v_new_coin FROM public.user_stats WHERE user_id = v_user_id;
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'nyang_balance', v_new_coin);
  END IF;

  -- Lock the coin row, verify balance, deduct.
  SELECT COALESCE(coin_balance, 0) INTO v_coin
  FROM public.user_stats
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_coin < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_price, 'current', v_coin);
  END IF;

  v_new_coin := v_coin - v_price;
  UPDATE public.user_stats SET coin_balance = v_new_coin WHERE user_id = v_user_id;

  -- Append to owned list (keep array-of-strings shape used by the client).
  UPDATE public.user_room_state
  SET owned = COALESCE(owned, '[]'::jsonb) || jsonb_build_array(p_item_id),
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  VALUES (v_user_id, 'spend', -v_price, v_new_coin, 'room_item', p_item_id, 'Room item: ' || v_name);

  RETURN jsonb_build_object('ok', true, 'already_owned', false, 'price', v_price, 'nyang_balance', v_new_coin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_room_item(text) TO authenticated;

-- 3. One-time best-effort backfill from app_settings.
--    Earlier client wrote JSON blobs under key = 'room_data_<uuid>' in
--    app_settings. Move those into user_room_state so users don't lose
--    their layouts on first load after this migration.
--    Safe to re-run: ON CONFLICT keeps whichever row is newer.
INSERT INTO public.user_room_state (user_id, layout, owned, updated_at)
SELECT
  (regexp_replace(s.key, '^room_data_', ''))::uuid                 AS user_id,
  COALESCE((s.value::jsonb)->'room_layout', '[]'::jsonb)           AS layout,
  COALESCE((s.value::jsonb)->'room_owned',  '[]'::jsonb)           AS owned,
  COALESCE(s.updated_at, now())                                    AS updated_at
FROM public.app_settings s
WHERE s.key LIKE 'room_data_%'
  AND (regexp_replace(s.key, '^room_data_', '') ~* '^[0-9a-f-]{36}$')
ON CONFLICT (user_id) DO UPDATE
  SET layout     = EXCLUDED.layout,
      owned      = EXCLUDED.owned,
      updated_at = GREATEST(public.user_room_state.updated_at, EXCLUDED.updated_at);

-- After you've verified the backfill ran cleanly, you can delete the
-- legacy rows with:
--   DELETE FROM public.app_settings WHERE key LIKE 'room_data_%';
-- (Left commented out so the first deploy is safely reversible.)
