-- IF EXISTS guard for the RLS hardening migration. Codex P2: my
-- previous migration (20260515_enable_rls_three_content_tables.sql)
-- used bare ALTER TABLE / CREATE POLICY which hard-fails the entire
-- migration if any one of the three tables is missing on a fresh
-- environment. The earlier hotfix for the same tables
-- (20260422_security_hotfix.sql) used IF EXISTS explicitly because
-- these objects aren't guaranteed in every deployment — removing
-- that guard here was a deployment-regression risk.
--
-- Fix: wrap each table's RLS+policy block in a DO + IF EXISTS check.
-- Re-running is safe (DROP IF EXISTS pattern).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='grammar_curriculum') THEN
    EXECUTE 'ALTER TABLE public.grammar_curriculum ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "grammar_curriculum public read" ON public.grammar_curriculum';
    EXECUTE 'CREATE POLICY "grammar_curriculum public read"
              ON public.grammar_curriculum FOR SELECT TO public USING (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='grammar_examples_cache') THEN
    EXECUTE 'ALTER TABLE public.grammar_examples_cache ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "grammar_examples_cache public read" ON public.grammar_examples_cache';
    EXECUTE 'CREATE POLICY "grammar_examples_cache public read"
              ON public.grammar_examples_cache FOR SELECT TO public USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "grammar_examples_cache auth insert" ON public.grammar_examples_cache';
    EXECUTE 'CREATE POLICY "grammar_examples_cache auth insert"
              ON public.grammar_examples_cache FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "grammar_examples_cache auth update" ON public.grammar_examples_cache';
    EXECUTE 'CREATE POLICY "grammar_examples_cache auth update"
              ON public.grammar_examples_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='listening_quiz_bank') THEN
    EXECUTE 'ALTER TABLE public.listening_quiz_bank ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "listening_quiz_bank public read" ON public.listening_quiz_bank';
    EXECUTE 'CREATE POLICY "listening_quiz_bank public read"
              ON public.listening_quiz_bank FOR SELECT TO public USING (true)';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
