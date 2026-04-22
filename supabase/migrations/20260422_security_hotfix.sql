-- ═══════════════════════════════════════════════════════════════
-- SECURITY HOTFIX — 2026-04-22
-- Fixes Supabase Security Advisor critical errors + user-data leaks.
-- Safe to re-run (uses IF EXISTS / DROP POLICY IF EXISTS guards).
--
--  🔴 Errors addressed:
--    - RLS Disabled in Public: grammar_curriculum, listening_quiz_bank,
--      grammar_examples_cache  (anon key could DELETE all rows)
--    - Policy Exists RLS Disabled: grammar_curriculum
--    - Security Definer View: game_leaderboard
--
--  🟠 Warnings addressed:
--    - RLS Policy Always True on user-owned tables (user_saved_words,
--      user_topic_history, xp_log) — replaces stray USING(true) policies
--      with auth.uid() = user_id so one user can't read another user's rows.
--    - Function Search Path Mutable: update_vgp_timestamp
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- PART 1: Public content tables — enable RLS, public read, service write
-- ─────────────────────────────────────────────────────────────

-- grammar_curriculum
ALTER TABLE IF EXISTS public.grammar_curriculum ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grammar_curriculum_public_read"  ON public.grammar_curriculum;
DROP POLICY IF EXISTS "grammar_curriculum_service_write" ON public.grammar_curriculum;
CREATE POLICY "grammar_curriculum_public_read"
  ON public.grammar_curriculum FOR SELECT USING (true);
CREATE POLICY "grammar_curriculum_service_write"
  ON public.grammar_curriculum FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- listening_quiz_bank
ALTER TABLE IF EXISTS public.listening_quiz_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "listening_quiz_bank_public_read"  ON public.listening_quiz_bank;
DROP POLICY IF EXISTS "listening_quiz_bank_service_write" ON public.listening_quiz_bank;
CREATE POLICY "listening_quiz_bank_public_read"
  ON public.listening_quiz_bank FOR SELECT USING (true);
CREATE POLICY "listening_quiz_bank_service_write"
  ON public.listening_quiz_bank FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- grammar_examples_cache — AI-generated example cache. Anyone can read
-- (cached output is non-sensitive). Authenticated users can insert new
-- cache rows (the study room generates+saves on demand). Service role
-- has full control for admin backfills.
ALTER TABLE IF EXISTS public.grammar_examples_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grammar_examples_cache_public_read"   ON public.grammar_examples_cache;
DROP POLICY IF EXISTS "grammar_examples_cache_auth_insert"   ON public.grammar_examples_cache;
DROP POLICY IF EXISTS "grammar_examples_cache_service_write" ON public.grammar_examples_cache;
CREATE POLICY "grammar_examples_cache_public_read"
  ON public.grammar_examples_cache FOR SELECT USING (true);
CREATE POLICY "grammar_examples_cache_auth_insert"
  ON public.grammar_examples_cache FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "grammar_examples_cache_service_write"
  ON public.grammar_examples_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- PART 2: game_leaderboard view — drop SECURITY DEFINER
-- A DEFINER view runs with the view owner's (usually postgres) privileges,
-- bypassing RLS on underlying tables. INVOKER means it enforces the
-- caller's RLS, which is what we want for a leaderboard that should only
-- surface whatever the caller is already allowed to see.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'game_leaderboard'
  ) THEN
    EXECUTE 'ALTER VIEW public.game_leaderboard SET (security_invoker = on)';
    RAISE NOTICE 'game_leaderboard: set security_invoker = on';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- PART 3: User-owned tables — replace USING(true) with auth.uid() = user_id
-- Drops all existing policies and recreates a clean set so stray old
-- "allow-everything" policies can't co-exist with the tight ones.
-- Only applies when the table exists AND has a user_id column.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['user_saved_words','user_topic_history','xp_log']
  LOOP
    -- Skip if table missing or has no user_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE 'skip %: no user_id column', tbl;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Wipe existing policies so USING(true) relics don't linger
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- Recreate owner-scoped policies
    EXECUTE format($f$
      CREATE POLICY "%1$s_users_read_own" ON public.%1$I
        FOR SELECT USING (auth.uid() = user_id)
    $f$, tbl);
    EXECUTE format($f$
      CREATE POLICY "%1$s_users_insert_own" ON public.%1$I
        FOR INSERT WITH CHECK (auth.uid() = user_id)
    $f$, tbl);
    EXECUTE format($f$
      CREATE POLICY "%1$s_users_update_own" ON public.%1$I
        FOR UPDATE USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $f$, tbl);
    EXECUTE format($f$
      CREATE POLICY "%1$s_users_delete_own" ON public.%1$I
        FOR DELETE USING (auth.uid() = user_id)
    $f$, tbl);
    EXECUTE format($f$
      CREATE POLICY "%1$s_service_full" ON public.%1$I
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role')
    $f$, tbl);

    RAISE NOTICE 'tightened RLS on %', tbl;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- PART 4: Pin search_path on update_vgp_timestamp
-- ALTER FUNCTION SET search_path doesn't touch the function body — safe.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_vgp_timestamp'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.update_vgp_timestamp(%s) SET search_path = public',
      fn.args
    );
    RAISE NOTICE 'pinned search_path on update_vgp_timestamp(%)', fn.args;
  END LOOP;
END $$;

-- Force PostgREST to reload the schema cache so the new policies take effect
-- without a dashboard restart.
NOTIFY pgrst, 'reload schema';
