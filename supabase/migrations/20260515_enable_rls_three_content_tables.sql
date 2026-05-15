-- SECURITY: enable RLS on the three tables Supabase flagged.
--
-- Supabase critical alert "rls_disabled_in_public" was triggered by
-- these three tables:
--   - grammar_curriculum
--   - grammar_examples_cache
--   - listening_quiz_bank
--
-- All three are content tables read by the Study Room. Without RLS,
-- anyone with the project URL + anon key can read/edit/delete every
-- row. Owner-pasted diagnostic query confirmed.
--
-- Policy strategy (matches the rest of the public-content pattern):
--   * Public SELECT — these tables don't carry secrets, just grammar
--     curriculum, AI-generated example cache, and listening quizzes.
--   * Writes:
--       - grammar_curriculum:    admin only (service-role bypass)
--       - grammar_examples_cache: authenticated UPSERT allowed (the
--         Study Room caches AI results here; signed-in users
--         legitimately upsert with their own queries). Service-role
--         still bypasses.
--       - listening_quiz_bank:   admin only (service-role bypass)
--
-- Service role bypasses RLS automatically, so admin generation
-- pipelines and edge functions keep working.

-- ── grammar_curriculum ────────────────────────────────────────
ALTER TABLE public.grammar_curriculum ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grammar_curriculum public read" ON public.grammar_curriculum;
CREATE POLICY "grammar_curriculum public read"
  ON public.grammar_curriculum
  FOR SELECT
  TO public
  USING (true);

-- ── grammar_examples_cache ───────────────────────────────────
ALTER TABLE public.grammar_examples_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grammar_examples_cache public read" ON public.grammar_examples_cache;
CREATE POLICY "grammar_examples_cache public read"
  ON public.grammar_examples_cache
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can INSERT new cache entries (caching AI
-- responses they just generated). Without this, every learner
-- regenerates the same Claude call on each visit because the
-- cache write was silently denied by RLS.
DROP POLICY IF EXISTS "grammar_examples_cache auth insert" ON public.grammar_examples_cache;
CREATE POLICY "grammar_examples_cache auth insert"
  ON public.grammar_examples_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow re-upsert of existing rows (the .upsert() call also needs
-- UPDATE permission when ON CONFLICT triggers).
DROP POLICY IF EXISTS "grammar_examples_cache auth update" ON public.grammar_examples_cache;
CREATE POLICY "grammar_examples_cache auth update"
  ON public.grammar_examples_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── listening_quiz_bank ──────────────────────────────────────
ALTER TABLE public.listening_quiz_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listening_quiz_bank public read" ON public.listening_quiz_bank;
CREATE POLICY "listening_quiz_bank public read"
  ON public.listening_quiz_bank
  FOR SELECT
  TO public
  USING (true);

NOTIFY pgrst, 'reload schema';
