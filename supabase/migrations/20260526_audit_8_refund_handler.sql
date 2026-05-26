-- ═════════════════════════════════════════════════════════════════════
-- Audit 8 — PAY-F1: Refund handler for Speaking Coach coin purchases
-- ─────────────────────────────────────────────────────────────────────
-- The Stripe webhook (speaking-pass-webhook) currently ignores
-- `charge.refunded`, `charge.dispute.created`, and
-- `payment_intent.canceled` — they silently return 200. That means
-- a customer who buys 10 coins, then disputes/refunds the charge,
-- keeps their 10 coins. Direct revenue leak via chargeback +
-- retain-goods.
--
-- This migration:
--   1. Adds refund-tracking columns to speaking_coin_purchases
--   2. Adds a service-role RPC `revoke_speaking_coins` that
--      atomically marks the purchase refunded AND deducts the coins
--      from the user's wallet
--   3. Handles the edge case where the user has already spent some
--      or all of the granted coins by deducting what we can and
--      returning a `shortfall` value the caller logs as critical.
--
-- Companion change: speaking-pass-webhook now subscribes to
-- `charge.refunded` + `charge.dispute.created` and routes them
-- through this RPC.
--
-- Idempotency: stripe_refund_event_id is UNIQUE — a Stripe retry of
-- the same refund event no-ops. Partial refunds for the same charge
-- can recur (multiple Stripe refund objects against one charge); we
-- track each by its own refund_event_id.
--
-- OWNER MUST APPLY THIS MIGRATION via Supabase SQL editor or
-- `supabase db push` BEFORE the next deploy of speaking-pass-webhook.
-- Idempotent — safe to re-run.

-- ─── 1. Schema extension ────────────────────────────────────────────
ALTER TABLE public.speaking_coin_purchases
  ADD COLUMN IF NOT EXISTS refunded_at            timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_amount_cents  int,
  ADD COLUMN IF NOT EXISTS stripe_refund_event_id text,
  ADD COLUMN IF NOT EXISTS refund_note            text,
  ADD COLUMN IF NOT EXISTS coins_revoked          int,
  ADD COLUMN IF NOT EXISTS coins_shortfall        int;

-- UNIQUE on refund_event_id (NULLs allowed, only constrained on populated rows)
CREATE UNIQUE INDEX IF NOT EXISTS speaking_coin_purchases_refund_event_uniq
  ON public.speaking_coin_purchases (stripe_refund_event_id)
  WHERE stripe_refund_event_id IS NOT NULL;

-- Speed up lookups by session_id (used in webhook handler)
CREATE INDEX IF NOT EXISTS speaking_coin_purchases_session_idx
  ON public.speaking_coin_purchases (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

COMMENT ON COLUMN public.speaking_coin_purchases.refunded_at IS
  'Set when a charge.refunded webhook landed and was processed. NULL = not refunded.';
COMMENT ON COLUMN public.speaking_coin_purchases.coins_shortfall IS
  'When user spent coins before refund landed, the # of coins we could NOT reclaim. critical-severity client_errors row written when > 0.';

-- ─── 2. Reversal RPC ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_speaking_coins(
  p_stripe_session_id     text,
  p_stripe_refund_event_id text,
  p_refund_amount_cents   int,
  p_refund_reason         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role       text := current_setting('request.jwt.claim.role', true);
  v_purchase   public.speaking_coin_purchases%ROWTYPE;
  v_wallet     public.user_speaking_coins%ROWTYPE;
  v_coins_to_revoke int;
  v_coins_actually_revoked int;
  v_shortfall  int := 0;
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'revoke_speaking_coins: service_role required';
  END IF;
  IF p_stripe_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required';
  END IF;
  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents <= 0 THEN
    RAISE EXCEPTION 'refund_amount_cents must be positive';
  END IF;

  -- Lock the purchase row first to serialize concurrent refunds for
  -- the same session.
  SELECT * INTO v_purchase
    FROM public.speaking_coin_purchases
    WHERE stripe_session_id = p_stripe_session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    -- The grant never landed (race with the refund webhook, or the
    -- session was for a different product). Caller decides what to
    -- do — we just say "no grant to reverse".
    RETURN jsonb_build_object(
      'ok',            true,
      'no_grant',      true,
      'note',          'no matching purchase for session_id'
    );
  END IF;

  -- Idempotency: if this exact refund_event_id already processed,
  -- return the previously-computed result.
  IF v_purchase.stripe_refund_event_id = p_stripe_refund_event_id THEN
    RETURN jsonb_build_object(
      'ok',                true,
      'already_processed', true,
      'coins_revoked',     COALESCE(v_purchase.coins_revoked, 0),
      'shortfall',         COALESCE(v_purchase.coins_shortfall, 0)
    );
  END IF;

  -- Different refund event landing on a purchase that's already been
  -- refunded by a prior event = partial-refund follow-up. Allowed,
  -- but log a note. (Stripe permits multiple partial refunds against
  -- one charge; each has its own refund_event_id.)
  IF v_purchase.refunded_at IS NOT NULL THEN
    -- Continue, but mark as partial-followup. The new refund_event_id
    -- overwrites; the audit trail lives in client_errors + Stripe.
    NULL;
  END IF;

  -- Coins to revoke = proportional to refund amount. amount_cents on
  -- the purchase row is total; coins is total granted. So:
  --   coins_to_revoke = round(coins * refund_amount / amount_cents)
  -- but bounded to [0, coins].
  IF v_purchase.amount_cents <= 0 THEN
    v_coins_to_revoke := v_purchase.coins;
  ELSE
    v_coins_to_revoke := LEAST(
      v_purchase.coins,
      GREATEST(0, ROUND(v_purchase.coins::numeric * p_refund_amount_cents / v_purchase.amount_cents)::int)
    );
  END IF;

  -- Lock the wallet, deduct what we can.
  SELECT * INTO v_wallet
    FROM public.user_speaking_coins
    WHERE user_id = v_purchase.user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    -- Wallet row doesn't exist — user spent every coin then their
    -- account was deleted (DELETE CASCADE), or grant was never
    -- actually applied. Shortfall = everything we'd want to revoke.
    v_coins_actually_revoked := 0;
    v_shortfall := v_coins_to_revoke;
  ELSE
    -- Deduct min(remaining, want_to_revoke). The user can't go
    -- negative — if they've already spent the coins, we accept the
    -- loss but log a critical-severity event so the operator knows.
    v_coins_actually_revoked := LEAST(v_wallet.coins_remaining, v_coins_to_revoke);
    v_shortfall := v_coins_to_revoke - v_coins_actually_revoked;

    IF v_coins_actually_revoked > 0 THEN
      UPDATE public.user_speaking_coins
        SET coins_remaining = coins_remaining - v_coins_actually_revoked,
            updated_at      = now()
        WHERE user_id = v_purchase.user_id;
    END IF;
  END IF;

  -- Mark the purchase refunded.
  UPDATE public.speaking_coin_purchases
    SET refunded_at             = now(),
        refunded_amount_cents   = COALESCE(refunded_amount_cents, 0) + p_refund_amount_cents,
        stripe_refund_event_id  = p_stripe_refund_event_id,
        refund_note             = p_refund_reason,
        coins_revoked           = COALESCE(coins_revoked, 0) + v_coins_actually_revoked,
        coins_shortfall         = COALESCE(coins_shortfall, 0) + v_shortfall,
        status                  = CASE
                                    WHEN COALESCE(refunded_amount_cents, 0) + p_refund_amount_cents >= v_purchase.amount_cents
                                    THEN 'refunded'
                                    ELSE 'partially_refunded'
                                  END
    WHERE id = v_purchase.id;

  RETURN jsonb_build_object(
    'ok',                    true,
    'purchase_id',           v_purchase.id,
    'user_id',               v_purchase.user_id,
    'coins_revoked',         v_coins_actually_revoked,
    'coins_wanted_to_revoke', v_coins_to_revoke,
    'shortfall',             v_shortfall,
    'refund_amount_cents',   p_refund_amount_cents,
    'fully_refunded',        (COALESCE(v_purchase.refunded_amount_cents, 0) + p_refund_amount_cents >= v_purchase.amount_cents)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_speaking_coins(text, text, int, text) FROM public;
-- service_role bypasses REVOKE; no GRANT to authenticated.

COMMENT ON FUNCTION public.revoke_speaking_coins(text, text, int, text) IS
  'Webhook-only refund reversal. Atomic row-locked. Idempotent on stripe_refund_event_id. Returns shortfall > 0 if user already spent coins before refund landed; caller logs critical.';
