-- ═══════════════════════════════════════════════════════════════
-- EMERGENCY SECURITY HOTFIX — 2026-04-08
-- Fixes Supabase Security Advisor critical errors & warnings:
--   1. RLS Disabled in Public (10 errors)
--   2. Function Search Path Mutable (41 warnings)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- PART 1: Drop test/scratch tables (no production purpose)
-- ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public._tmp_test_table;
DROP TABLE IF EXISTS public.zzz_test;

-- ─────────────────────────────────────────────────────────────
-- PART 2: Enable RLS on coin economy tables
-- (from 20260327_shop_coin_economy.sql — RLS was missing)
-- ─────────────────────────────────────────────────────────────

-- 2a) shop_items — public catalog, anyone can read
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_items_public_read" ON public.shop_items;
CREATE POLICY "shop_items_public_read"
  ON public.shop_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shop_items_service_write" ON public.shop_items;
CREATE POLICY "shop_items_service_write"
  ON public.shop_items FOR ALL
  USING (auth.role() = 'service_role');

-- 2b) coin_transactions — users see only their own
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coin_tx_users_read_own" ON public.coin_transactions;
CREATE POLICY "coin_tx_users_read_own"
  ON public.coin_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "coin_tx_service_full" ON public.coin_transactions;
CREATE POLICY "coin_tx_service_full"
  ON public.coin_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- 2c) shop_purchases — users see only their own
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_purchases_users_read_own" ON public.shop_purchases;
CREATE POLICY "shop_purchases_users_read_own"
  ON public.shop_purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shop_purchases_service_full" ON public.shop_purchases;
CREATE POLICY "shop_purchases_service_full"
  ON public.shop_purchases FOR ALL
  USING (auth.role() = 'service_role');

-- 2d) owned_items — users see only their own
ALTER TABLE public.owned_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owned_items_users_read_own" ON public.owned_items;
CREATE POLICY "owned_items_users_read_own"
  ON public.owned_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owned_items_service_full" ON public.owned_items;
CREATE POLICY "owned_items_service_full"
  ON public.owned_items FOR ALL
  USING (auth.role() = 'service_role');

-- 2e) payment_orders — users see only their own
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_orders_users_read_own" ON public.payment_orders;
CREATE POLICY "payment_orders_users_read_own"
  ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payment_orders_service_full" ON public.payment_orders;
CREATE POLICY "payment_orders_service_full"
  ON public.payment_orders FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- PART 3: Enable RLS on conversations_data (if not already)
-- Content table — public read, service_role write
-- ─────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.conversations_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_data_public_read" ON public.conversations_data;
CREATE POLICY "conversations_data_public_read"
  ON public.conversations_data FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "conversations_data_service_write" ON public.conversations_data;
CREATE POLICY "conversations_data_service_write"
  ON public.conversations_data FOR ALL
  USING (auth.role() = 'service_role');

-- Also handle 'conversations' table if it exists separately
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies if any
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "conversations_public_read" ON public.conversations';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    EXECUTE 'CREATE POLICY "conversations_public_read" ON public.conversations FOR SELECT USING (true)';

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "conversations_service_write" ON public.conversations';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    EXECUTE 'CREATE POLICY "conversations_service_write" ON public.conversations FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- PART 4: Fix search_path on functions defined in migrations
-- Prevents privilege escalation via mutable search_path
-- ─────────────────────────────────────────────────────────────

-- 4a) is_admin_email() — recreate with SET search_path
CREATE OR REPLACE FUNCTION public.is_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'email','') IN ('enane960819@gmail.com');
$$;

-- 4b) purchase_coin_shop_item — recreate with SET search_path
CREATE OR REPLACE FUNCTION public.purchase_coin_shop_item(p_user_id uuid, p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.shop_items%rowtype;
  v_coin bigint;
  v_owned int;
  v_new_coin bigint;
BEGIN
  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND'); END IF;
  IF NOT v_item.can_buy_with_coin THEN RETURN jsonb_build_object('ok', false, 'error', 'COIN_NOT_ALLOWED'); END IF;

  SELECT coalesce(coin_balance,0) INTO v_coin FROM public.user_stats WHERE user_id = p_user_id;
  IF v_coin < coalesce(v_item.coin_price,0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_COIN');
  END IF;

  SELECT quantity INTO v_owned FROM public.owned_items WHERE user_id = p_user_id AND item_id = p_item_id;
  IF coalesce(v_owned,0) > 0 AND NOT v_item.is_repeatable THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_OWNED');
  END IF;

  v_new_coin := v_coin - coalesce(v_item.coin_price,0);
  UPDATE public.user_stats SET coin_balance = v_new_coin WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  VALUES (p_user_id, 'spend', -coalesce(v_item.coin_price,0), v_new_coin, 'shop_purchase', p_item_id, v_item.name);

  INSERT INTO public.shop_purchases(user_id, item_id, purchase_type, coin_spent, payment_status)
  VALUES (p_user_id, p_item_id, 'coin', coalesce(v_item.coin_price,0), 'completed');

  INSERT INTO public.owned_items(user_id, item_id, quantity)
  VALUES (p_user_id, p_item_id, 1)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = public.owned_items.quantity + CASE WHEN v_item.is_repeatable THEN 1 ELSE 0 END;

  RETURN jsonb_build_object('ok', true, 'coin_balance', v_new_coin);
END;
$$;

-- 4c) admin_adjust_coin — recreate with SET search_path
CREATE OR REPLACE FUNCTION public.admin_adjust_coin(p_user_id uuid, p_delta bigint, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coin bigint;
  v_new bigint;
BEGIN
  SELECT coalesce(coin_balance,0) INTO v_coin FROM public.user_stats WHERE user_id = p_user_id;
  v_new := greatest(0, v_coin + p_delta);
  UPDATE public.user_stats SET coin_balance = v_new WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions(user_id, tx_type, amount, balance_after, source, memo)
  VALUES (p_user_id, 'admin_adjust', p_delta, v_new, 'admin', p_reason);

  RETURN jsonb_build_object('ok', true, 'coin_balance', v_new);
END;
$$;

-- 4d) send_reporter_gift — recreate with SET search_path
--     (uses the corrected signature from 20260327_send_reporter_gift_rpc_fix.sql)
CREATE OR REPLACE FUNCTION public.send_reporter_gift(
  p_item_id text,
  p_reporter_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.shop_items%rowtype;
  v_owned int;
  v_coin bigint;
  v_new_coin bigint;
  v_cost bigint;
  v_used_owned boolean := false;
  v_aff_add bigint;
BEGIN
  IF p_user_id IS NULL OR coalesce(p_reporter_id,'') = '' OR coalesce(p_item_id,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_item
  FROM public.shop_items
  WHERE id = p_item_id AND is_active = true AND item_type = 'reporter_item';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ITEM_NOT_GIFTABLE');
  END IF;

  v_cost := coalesce(v_item.coin_price, 0);

  SELECT coalesce(quantity, 0) INTO v_owned
  FROM public.owned_items
  WHERE user_id = p_user_id AND item_id = p_item_id;

  IF v_owned > 0 THEN
    UPDATE public.owned_items
    SET quantity = quantity - 1
    WHERE user_id = p_user_id AND item_id = p_item_id;

    DELETE FROM public.owned_items
    WHERE user_id = p_user_id AND item_id = p_item_id AND quantity <= 0;

    v_used_owned := true;
    SELECT coalesce(coin_balance,0) INTO v_new_coin FROM public.user_stats WHERE user_id = p_user_id;
  ELSE
    SELECT coalesce(coin_balance,0) INTO v_coin
    FROM public.user_stats
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_coin < v_cost THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_cost, 'current', v_coin);
    END IF;

    v_new_coin := v_coin - v_cost;
    UPDATE public.user_stats SET coin_balance = v_new_coin WHERE user_id = p_user_id;

    INSERT INTO public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
    VALUES (p_user_id, 'spend', -v_cost, v_new_coin, 'reporter_gift_direct', p_item_id, coalesce(v_item.name,'Reporter gift'));
  END IF;

  INSERT INTO public.reporter_gift_history(user_id, reporter_id, item_id, quantity, nyang_spent)
  VALUES (p_user_id, p_reporter_id, p_item_id, 1, CASE WHEN v_used_owned THEN 0 ELSE v_cost END);

  v_aff_add := greatest(10, v_cost);
  INSERT INTO public.reporter_user_affinity(user_id, reporter_id, gift_count, affinity_points)
  VALUES (p_user_id, p_reporter_id, 1, v_aff_add)
  ON CONFLICT (user_id, reporter_id)
  DO UPDATE SET
    gift_count = reporter_user_affinity.gift_count + 1,
    affinity_points = reporter_user_affinity.affinity_points + excluded.affinity_points,
    updated_at = now();

  SELECT coalesce(quantity, 0) INTO v_owned
  FROM public.owned_items
  WHERE user_id = p_user_id AND item_id = p_item_id;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'used_owned', v_used_owned,
    'nyang_balance', coalesce(v_new_coin, v_coin, 0),
    'remaining_owned', coalesce(v_owned,0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'GIFT_PROCESS_FAILED');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- PART 5: Fix search_path on functions that exist in DB
-- but are NOT defined in migration files
-- Uses ALTER FUNCTION (does not change function body)
-- ─────────────────────────────────────────────────────────────

-- These functions were created via Supabase SQL Editor or earlier
-- untracked migrations. ALTER FUNCTION SET search_path is safe
-- and does not modify the function body.

DO $$
DECLARE
  fn record;
BEGIN
  -- Find all public schema functions that lack a pinned search_path
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
           p.oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname NOT LIKE 'pg_%'
      AND p.proname NOT LIKE '_pg_%'
      -- Only functions without search_path already set
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public',
        fn.func_name,
        fn.args
      );
      RAISE NOTICE 'Fixed search_path: public.%(%)', fn.func_name, fn.args;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not fix search_path for public.%(%): %', fn.func_name, fn.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- PART 6: Catch-all — enable RLS on any public tables missing it
-- (Safety net for tables created outside migrations)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_pg_%'
      AND tablename NOT IN (
        SELECT tablename
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
        WHERE c.relrowsecurity = true
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
      RAISE NOTICE 'Enabled RLS on: public.%', tbl.tablename;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not enable RLS on public.%: %', tbl.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run manually after applying):
--
-- Check RLS status on all public tables:
--   SELECT tablename, rowsecurity
--   FROM pg_tables t
--   JOIN pg_class c ON c.relname = t.tablename
--   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
--   WHERE t.schemaname = 'public'
--   ORDER BY tablename;
--
-- Check function search_path settings:
--   SELECT proname, proconfig
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--   ORDER BY proname;
-- ═══════════════════════════════════════════════════════════════
