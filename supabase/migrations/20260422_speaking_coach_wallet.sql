-- ═════════════════════════════════════════════════════════════════
-- Speaking Coach v3 — Wallet model (supersedes v2 daily pass)
-- ─────────────────────────────────────────────────────────────────
-- v2 was a fixed $1/$3 daily pass with level-based coin quota.
-- v3 is a persistent coin wallet:
--
--   $1 = 1 coin          (flat, no level distinction on price)
--   Minimum purchase 5   (enforced by the Edge Function)
--   Coins persist        (don't expire day-to-day)
--   1 coin = 1 submission to a human coach
--
-- Level still controls the char cap on submissions (Seed/Sprout 250,
-- Tree 500, Forest → 1:1 tutoring upsell, no coins sold).
-- ═════════════════════════════════════════════════════════════════

-- Drop v2 pass RPCs and (optionally) the pass table. We KEEP the table
-- around for refund/audit history; you can drop it later if unused.
DROP FUNCTION IF EXISTS public.get_speaking_pass_status(text);
DROP FUNCTION IF EXISTS public.consume_speaking_coin(text);
DROP FUNCTION IF EXISTS public.create_speaking_pass(uuid, text, text, int, date);

-- 1) Persistent coin wallet. Repurposes the v1 user_speaking_coins
--    table — adds columns idempotently so existing rows aren't lost.
CREATE TABLE IF NOT EXISTS public.user_speaking_coins (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_remaining    int  NOT NULL DEFAULT 0,
  last_refresh_date  date NOT NULL DEFAULT current_date,  -- vestigial from v1, retained for history
  total_submitted    int  NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_speaking_coins
  ADD COLUMN IF NOT EXISTS total_purchased int NOT NULL DEFAULT 0;

ALTER TABLE public.user_speaking_coins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_speaking_coins' AND policyname = 'user_speaking_coins_select_own'
  ) THEN
    CREATE POLICY "user_speaking_coins_select_own"
      ON public.user_speaking_coins FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Purchase history (one row per successful Stripe checkout).
CREATE TABLE IF NOT EXISTS public.speaking_coin_purchases (
  id                 bigserial PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins              int  NOT NULL CHECK (coins >= 1),
  amount_cents       int  NOT NULL,
  currency           text NOT NULL DEFAULT 'usd',
  stripe_session_id  text UNIQUE,
  status             text NOT NULL DEFAULT 'completed',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speaking_coin_purchases_user_idx
  ON public.speaking_coin_purchases (user_id, created_at DESC);

ALTER TABLE public.speaking_coin_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'speaking_coin_purchases' AND policyname = 'speaking_coin_purchases_select_own'
  ) THEN
    CREATE POLICY "speaking_coin_purchases_select_own"
      ON public.speaking_coin_purchases FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Level → char cap (no more price — pricing is flat $1/coin)
CREATE OR REPLACE FUNCTION public._speaking_level_meta(p_level text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 'Starter'      THEN jsonb_build_object('char_cap', 250, 'sellable', true)
    WHEN 'Beginner'     THEN jsonb_build_object('char_cap', 250, 'sellable', true)
    WHEN 'Intermediate' THEN jsonb_build_object('char_cap', 500, 'sellable', true)
    WHEN 'Advanced'     THEN jsonb_build_object('char_cap', 0,   'sellable', false)
    ELSE jsonb_build_object('char_cap', 250, 'sellable', true)
  END;
$$;

-- 4) Read wallet status for the UI badge.
--    Returns: { balance, level, char_cap, sellable, min_purchase }
CREATE OR REPLACE FUNCTION public.get_speaking_wallet_status(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid  := auth.uid();
  v_meta  jsonb := public._speaking_level_meta(p_level);
  v_bal   int   := 0;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT coins_remaining INTO v_bal
      FROM public.user_speaking_coins WHERE user_id = v_uid;
    v_bal := COALESCE(v_bal, 0);
  END IF;

  RETURN jsonb_build_object(
    'balance',       v_bal,
    'level',         p_level,
    'char_cap',      (v_meta->>'char_cap')::int,
    'sellable',      (v_meta->>'sellable')::boolean,
    'min_purchase',  5,
    'price_per_coin_cents', 100
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_speaking_wallet_status(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_speaking_wallet_status(text) TO authenticated;

-- 5) Consume one coin from the wallet. Atomic row-locked decrement.
--    Returns: { ok: true, balance: N }
--         or: { ok: false, reason: 'no_coins' | 'forest_redirect' }
CREATE OR REPLACE FUNCTION public.consume_speaking_coin(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_meta  jsonb := public._speaking_level_meta(p_level);
  v_row   public.user_speaking_coins%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT (v_meta->>'sellable')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forest_redirect');
  END IF;

  SELECT * INTO v_row
    FROM public.user_speaking_coins
    WHERE user_id = v_uid
    FOR UPDATE;

  IF NOT FOUND OR v_row.coins_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_coins', 'balance', COALESCE(v_row.coins_remaining, 0));
  END IF;

  UPDATE public.user_speaking_coins
    SET coins_remaining = coins_remaining - 1,
        total_submitted = total_submitted + 1,
        updated_at      = now()
    WHERE user_id = v_uid
    RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'balance', v_row.coins_remaining);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_speaking_coin(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.consume_speaking_coin(text) TO authenticated;

-- 6) Webhook-only: grant purchased coins to the wallet. Idempotent on
--    stripe_session_id (UNIQUE on purchases table).
CREATE OR REPLACE FUNCTION public.grant_speaking_coins(
  p_user_id           uuid,
  p_coins             int,
  p_amount_cents      int,
  p_stripe_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role       text := current_setting('request.jwt.claim.role', true);
  v_existing   public.speaking_coin_purchases%ROWTYPE;
  v_wallet     public.user_speaking_coins%ROWTYPE;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'grant_speaking_coins: service_role required';
  END IF;
  IF p_coins <= 0 THEN
    RAISE EXCEPTION 'coins must be positive';
  END IF;

  -- Idempotency: if this session_id already granted, return that state.
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.speaking_coin_purchases
      WHERE stripe_session_id = p_stripe_session_id;
    IF FOUND THEN
      SELECT * INTO v_wallet FROM public.user_speaking_coins WHERE user_id = p_user_id;
      RETURN jsonb_build_object(
        'ok',            true,
        'already_granted', true,
        'balance',       COALESCE(v_wallet.coins_remaining, 0)
      );
    END IF;
  END IF;

  INSERT INTO public.speaking_coin_purchases
    (user_id, coins, amount_cents, stripe_session_id, status)
  VALUES
    (p_user_id, p_coins, p_amount_cents, p_stripe_session_id, 'completed');

  INSERT INTO public.user_speaking_coins (user_id, coins_remaining, total_purchased)
    VALUES (p_user_id, p_coins, p_coins)
    ON CONFLICT (user_id) DO UPDATE
      SET coins_remaining = user_speaking_coins.coins_remaining + EXCLUDED.coins_remaining,
          total_purchased = user_speaking_coins.total_purchased + EXCLUDED.total_purchased,
          updated_at      = now()
    RETURNING * INTO v_wallet;

  RETURN jsonb_build_object(
    'ok',      true,
    'balance', v_wallet.coins_remaining,
    'granted', p_coins
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_speaking_coins(uuid, int, int, text) FROM public;
-- service_role bypasses REVOKE; no explicit GRANT to authenticated.

COMMENT ON TABLE  public.user_speaking_coins     IS 'Persistent wallet — $1 = 1 coin, coins do not expire';
COMMENT ON TABLE  public.speaking_coin_purchases IS 'Stripe checkout history, one row per completed session';
COMMENT ON FUNCTION public.get_speaking_wallet_status(text) IS 'UI read — wallet balance + level char cap + min purchase';
COMMENT ON FUNCTION public.consume_speaking_coin(text)      IS 'Decrement wallet by 1, atomic row-locked';
COMMENT ON FUNCTION public.grant_speaking_coins(uuid,int,int,text) IS 'Webhook-only grant, idempotent on stripe_session_id';
