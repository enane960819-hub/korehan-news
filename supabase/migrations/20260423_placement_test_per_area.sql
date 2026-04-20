-- ═════════════════════════════════════════════════════════════════
-- Phase 3 — Placement Test (per-area result + persistent record)
-- ─────────────────────────────────────────────────────────────────
-- The onboarding placement test previously produced a single-number
-- score with a level recommendation that the user could override.
-- v2 keeps the override but now:
--   • Asks per-area questions (Reading / Listening / Grammar / Vocab)
--   • Returns per-area 0-100 scores
--   • Persists the full result to user_placement_result so we can
--     compare future retakes and feed the Learning Hub.
--   • Writes the chosen level back to user_stats.level (same column
--     the "pick my level" path already uses).
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_placement_result (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at          timestamptz NOT NULL DEFAULT now(),
  version           text NOT NULL DEFAULT 'v2',

  -- Per-area 0-100 scores
  reading_score     int NOT NULL DEFAULT 0,
  listening_score   int NOT NULL DEFAULT 0,
  grammar_score     int NOT NULL DEFAULT 0,
  vocab_score       int NOT NULL DEFAULT 0,

  -- Computed level (Starter | Beginner | Intermediate | Advanced)
  recommended_level text NOT NULL,
  chosen_level      text NOT NULL,

  -- Full answer trail for audit / future adaptive tuning
  answers           jsonb,

  CONSTRAINT _placement_level_valid
    CHECK (recommended_level IN ('Starter','Beginner','Intermediate','Advanced')
       AND chosen_level      IN ('Starter','Beginner','Intermediate','Advanced'))
);

CREATE INDEX IF NOT EXISTS user_placement_result_user_date_idx
  ON public.user_placement_result (user_id, taken_at DESC);

ALTER TABLE public.user_placement_result ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_placement_result' AND policyname = 'upr_select_own'
  ) THEN
    CREATE POLICY "upr_select_own"
      ON public.user_placement_result FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Save result + sync the user's level in one atomic RPC so the
-- onboarding flow doesn't have to touch two tables from the client.
CREATE OR REPLACE FUNCTION public.save_placement_result(
  p_reading_score     int,
  p_listening_score   int,
  p_grammar_score     int,
  p_vocab_score       int,
  p_recommended_level text,
  p_chosen_level      text,
  p_answers           jsonb DEFAULT NULL,
  p_version           text  DEFAULT 'v2'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_chosen_level NOT IN ('Starter','Beginner','Intermediate','Advanced') THEN
    RAISE EXCEPTION 'invalid chosen_level';
  END IF;

  INSERT INTO public.user_placement_result
    (user_id, reading_score, listening_score, grammar_score, vocab_score,
     recommended_level, chosen_level, answers, version)
  VALUES
    (v_uid,
     GREATEST(0, LEAST(100, COALESCE(p_reading_score, 0))),
     GREATEST(0, LEAST(100, COALESCE(p_listening_score, 0))),
     GREATEST(0, LEAST(100, COALESCE(p_grammar_score, 0))),
     GREATEST(0, LEAST(100, COALESCE(p_vocab_score, 0))),
     p_recommended_level,
     p_chosen_level,
     p_answers,
     p_version)
  RETURNING id INTO v_id;

  -- Mirror the chosen level into user_stats (same column the "pick my
  -- level" branch of onboarding writes to). Uses upsert because new
  -- accounts may not have a user_stats row yet.
  INSERT INTO public.user_stats (user_id, level)
    VALUES (v_uid, p_chosen_level)
    ON CONFLICT (user_id) DO UPDATE
      SET level = EXCLUDED.level;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_placement_result(int,int,int,int,text,text,jsonb,text) FROM public;
GRANT  EXECUTE ON FUNCTION public.save_placement_result(int,int,int,int,text,text,jsonb,text) TO authenticated;

COMMENT ON TABLE  public.user_placement_result IS 'Per-area placement test outcomes; one row per attempt';
COMMENT ON FUNCTION public.save_placement_result(int,int,int,int,text,text,jsonb,text) IS 'Persist a placement result and sync user_stats.level in one atomic call';
