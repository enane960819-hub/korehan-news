-- ═════════════════════════════════════════════════════════════════
-- Speaking Coach — Daily Pass model (supersedes v1 coin quota)
-- ─────────────────────────────────────────────────────────────────
-- v1 gave all Pro users a free daily quota. v2 makes coach review a
-- paid add-on: user must buy a daily pass to get coins for that day.
--
--   Seed / Sprout  →  $1/day pass → 5 coach coins (250 char cap)
--   Tree           →  $3/day pass → 10 coach coins (500 char cap)
--   Forest         →  No pass     → 1:1 tutoring upsell (handled in FE)
--
-- Passes are KST-day scoped and do NOT roll over. If you don't buy,
-- you can't submit to the coach. Purchase goes through Stripe
-- Checkout → webhook → create_speaking_pass() (service-role RPC).
-- ═════════════════════════════════════════════════════════════════

-- Drop the v1 free-quota RPCs; we keep user_speaking_coins around for
-- analytics (total_submitted) but no longer use it for gating.
DROP FUNCTION IF EXISTS public.consume_speaking_coin(text);
DROP FUNCTION IF EXISTS public.get_speaking_coin_balance(text);

-- 1) Daily pass records — one row per (user, KST date).
CREATE TABLE IF NOT EXISTS public.speaking_coach_passes (
  id                  bigserial PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valid_date          date NOT NULL,                           -- KST day the pass is good for
  level               text NOT NULL,                           -- 'Starter' | 'Beginner' | 'Intermediate'
  coins_granted       int  NOT NULL,                           -- 5 or 10
  coins_used          int  NOT NULL DEFAULT 0,
  stripe_session_id   text UNIQUE,                             -- Stripe checkout.session.id
  amount_cents        int  NOT NULL,                           -- 100 or 300
  currency            text NOT NULL DEFAULT 'usd',
  status              text NOT NULL DEFAULT 'active',          -- 'active' | 'refunded'
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, valid_date)                                  -- one pass per user per day
);

CREATE INDEX IF NOT EXISTS speaking_coach_passes_user_date_idx
  ON public.speaking_coach_passes (user_id, valid_date DESC);

ALTER TABLE public.speaking_coach_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speaking_coach_passes_select_own"
  ON public.speaking_coach_passes FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies — only SECURITY DEFINER RPCs below write here.

-- 2) Level → (coin count, price cents) lookup
CREATE OR REPLACE FUNCTION public._speaking_pass_plan(p_level text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 'Starter'      THEN jsonb_build_object('coins', 5,  'price_cents', 100)
    WHEN 'Beginner'     THEN jsonb_build_object('coins', 5,  'price_cents', 100)
    WHEN 'Intermediate' THEN jsonb_build_object('coins', 10, 'price_cents', 300)
    WHEN 'Advanced'     THEN jsonb_build_object('coins', 0,  'price_cents', 0)
    ELSE jsonb_build_object('coins', 5, 'price_cents', 100)
  END;
$$;

-- KST "today" helper
CREATE OR REPLACE FUNCTION public._kst_today()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Asia/Seoul')::date;
$$;

-- 3) Pass status for the logged-in user — used by the coin badge UI
--    Returns: { has_pass, remaining, granted, price_cents, needs_purchase, reason? }
CREATE OR REPLACE FUNCTION public.get_speaking_pass_status(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_today date := public._kst_today();
  v_plan  jsonb := public._speaking_pass_plan(p_level);
  v_pass  public.speaking_coach_passes%ROWTYPE;
BEGIN
  IF (v_plan->>'coins')::int = 0 THEN
    RETURN jsonb_build_object('has_pass', false, 'reason', 'forest_redirect');
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'has_pass',       false,
      'needs_purchase', true,
      'price_cents',    v_plan->>'price_cents',
      'coins',          v_plan->>'coins',
      'level',          p_level
    );
  END IF;

  SELECT * INTO v_pass
    FROM public.speaking_coach_passes
    WHERE user_id = v_uid
      AND valid_date = v_today
      AND status = 'active'
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_pass',       false,
      'needs_purchase', true,
      'price_cents',    (v_plan->>'price_cents')::int,
      'coins',          (v_plan->>'coins')::int,
      'level',          p_level
    );
  END IF;

  RETURN jsonb_build_object(
    'has_pass',  true,
    'remaining', GREATEST(v_pass.coins_granted - v_pass.coins_used, 0),
    'granted',   v_pass.coins_granted,
    'valid_date', v_pass.valid_date,
    'level',     v_pass.level
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_speaking_pass_status(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_speaking_pass_status(text) TO authenticated;

-- 4) Consume one coin from today's active pass. Atomic, row-locked.
--    Returns: { ok: true, remaining: N }
--         or: { ok: false, reason: 'no_pass' | 'pass_exhausted' | 'forest_redirect' }
CREATE OR REPLACE FUNCTION public.consume_speaking_coin(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_today  date := public._kst_today();
  v_plan   jsonb := public._speaking_pass_plan(p_level);
  v_pass   public.speaking_coach_passes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF (v_plan->>'coins')::int = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forest_redirect');
  END IF;

  SELECT * INTO v_pass
    FROM public.speaking_coach_passes
    WHERE user_id = v_uid
      AND valid_date = v_today
      AND status = 'active'
    LIMIT 1
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pass');
  END IF;

  IF v_pass.coins_used >= v_pass.coins_granted THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pass_exhausted', 'remaining', 0);
  END IF;

  UPDATE public.speaking_coach_passes
    SET coins_used = coins_used + 1,
        updated_at = now()
    WHERE id = v_pass.id
    RETURNING * INTO v_pass;

  RETURN jsonb_build_object(
    'ok',        true,
    'remaining', v_pass.coins_granted - v_pass.coins_used
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_speaking_coin(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.consume_speaking_coin(text) TO authenticated;

-- 5) Called by the Stripe webhook only (SECURITY DEFINER, service-role
--    check inside). Creates the pass row after a successful payment.
CREATE OR REPLACE FUNCTION public.create_speaking_pass(
  p_user_id            uuid,
  p_level              text,
  p_stripe_session_id  text,
  p_amount_cents       int,
  p_valid_date         date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role  text := current_setting('request.jwt.claim.role', true);
  v_plan  jsonb := public._speaking_pass_plan(p_level);
  v_date  date := COALESCE(p_valid_date, public._kst_today());
  v_row   public.speaking_coach_passes%ROWTYPE;
BEGIN
  -- Only the Edge Function (service_role key) may call this.
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_speaking_pass: service_role required';
  END IF;

  IF (v_plan->>'coins')::int = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forest_not_sold');
  END IF;

  -- Idempotent on (user, valid_date) — second call for same day updates.
  INSERT INTO public.speaking_coach_passes
    (user_id, valid_date, level, coins_granted, coins_used,
     stripe_session_id, amount_cents, status)
  VALUES
    (p_user_id, v_date, p_level, (v_plan->>'coins')::int, 0,
     p_stripe_session_id, p_amount_cents, 'active')
  ON CONFLICT (user_id, valid_date) DO UPDATE
    SET level             = EXCLUDED.level,
        coins_granted     = EXCLUDED.coins_granted,
        stripe_session_id = COALESCE(EXCLUDED.stripe_session_id, speaking_coach_passes.stripe_session_id),
        amount_cents      = EXCLUDED.amount_cents,
        status            = 'active',
        updated_at        = now()
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row
      FROM public.speaking_coach_passes
      WHERE user_id = p_user_id AND valid_date = v_date;
  END IF;

  RETURN jsonb_build_object(
    'ok',           true,
    'pass_id',      v_row.id,
    'valid_date',   v_row.valid_date,
    'coins_granted',v_row.coins_granted
  );
END;
$$;

-- Not granted to authenticated/anon — service_role has implicit access.
REVOKE EXECUTE ON FUNCTION public.create_speaking_pass(uuid, text, text, int, date) FROM public;

COMMENT ON TABLE  public.speaking_coach_passes IS 'Daily $1/$3 coach-review pass — one row per user per KST day';
COMMENT ON FUNCTION public.consume_speaking_coin(text)         IS 'Atomic coin decrement against today''s active pass';
COMMENT ON FUNCTION public.get_speaking_pass_status(text)      IS 'Read-only pass status for UI badge (shows price if unpurchased)';
COMMENT ON FUNCTION public.create_speaking_pass(uuid,text,text,int,date) IS 'Webhook-only: create/update today''s pass after Stripe payment';
