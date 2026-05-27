-- ═════════════════════════════════════════════════════════════════════
-- Audit 13 (DB performance) — Missing-index sweep
-- ═════════════════════════════════════════════════════════════════════
-- Closes the index-side P0/P1 findings from audit 13:
--   PERF-F1  user_saved_words(user_id, created_at DESC)
--   PERF-F2  xp_log(user_id, created_at DESC)
--   PERF-F3  shop tables: coin_transactions / owned_items /
--            shop_purchases / payment_orders — FK column user_id
--            indexes for ON DELETE CASCADE perf
--   PERF-F11 user_stats(xp DESC NULLS LAST) for the admin leaderboard
--
-- Each CREATE INDEX is wrapped in a DO block that first checks
-- pg_class to skip cleanly if the table doesn't exist on this
-- project (some shop/SRS migrations may not be applied on every
-- environment). Idempotent — safe to re-run.
--
-- OWNER MUST APPLY this migration via Supabase SQL editor or
-- `supabase db push`.

-- ─── PERF-F1: user_saved_words ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_saved_words' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS user_saved_words_user_created_idx
             ON public.user_saved_words (user_id, created_at DESC)';
  END IF;
END $$;

-- ─── PERF-F2: xp_log ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'xp_log' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS xp_log_user_created_idx
             ON public.xp_log (user_id, created_at DESC)';
  END IF;
END $$;

-- ─── PERF-F3: shop / payment tables FK indexes ──────────────────────
-- These are referencing auth.users(id) with ON DELETE CASCADE.
-- Without the index, account deletion does O(table_size) seq scans
-- per referencing table — fine at 100 users, painful at 10k+.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'coin_transactions' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS coin_transactions_user_idx
             ON public.coin_transactions (user_id, created_at DESC)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'owned_items' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS owned_items_user_idx
             ON public.owned_items (user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shop_purchases' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS shop_purchases_user_idx
             ON public.shop_purchases (user_id, created_at DESC)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'payment_orders' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS payment_orders_user_idx
             ON public.payment_orders (user_id, created_at DESC)';
  END IF;
END $$;

-- ─── PERF-F11: user_stats(xp DESC NULLS LAST) for leaderboard ───────
-- The admin leaderboard at korehan-x9f4k2m7.html:1998 does
-- ORDER BY xp DESC without an index — 10k-row sort on every load.
-- NULLS LAST so unranked users (xp IS NULL) sit at the bottom.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_stats' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS user_stats_xp_desc_idx
             ON public.user_stats (xp DESC NULLS LAST)';
  END IF;
END $$;

COMMENT ON INDEX public.user_saved_words_user_created_idx IS
  'PERF-F1: hot path — Notes / Word Bank / Study Room read by user_id.';
COMMENT ON INDEX public.xp_log_user_created_idx IS
  'PERF-F2: My Page recent-XP read by user_id ORDER BY created_at DESC LIMIT 50.';
COMMENT ON INDEX public.user_stats_xp_desc_idx IS
  'PERF-F11: admin leaderboard ORDER BY xp DESC.';
