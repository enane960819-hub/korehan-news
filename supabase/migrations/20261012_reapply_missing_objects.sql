-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Re-apply objects the frontend calls but prod never got (2026-10-12 sweep)
-- ═════════════════════════════════════════════════════════════════════
-- supabase/reports/2026-10-12_frontend_schema_drift.sql found these missing:
--   RPCs  buy_room_item, finish_read_event, get_recent_wpm,
--         get_recent_writing_rubric, get_recent_speaking_scores,
--         save_placement_result, increment_srs_review_count,
--         increment_ft_play_count
--   tables user_room_state (My Room save / item loss), essential_expressions,
--         daily_reviews, coin_adjustments
-- The original migration files were never run in prod. Their statements are
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE); two were tightened below
-- (room backfill no longer overwrites, weekly-snapshot ALTER guarded).


-- ── from 20260424_user_room_state.sql ──
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
ON CONFLICT (user_id) DO NOTHING;

-- After you've verified the backfill ran cleanly, you can delete the
-- legacy rows with:
--   DELETE FROM public.app_settings WHERE key LIKE 'room_data_%';
-- (Left commented out so the first deploy is safely reversible.)


-- ── from 20260422_reading_time_and_writing_rubric.sql ──
-- ═════════════════════════════════════════════════════════════════
-- Phase 1 — Reading time (WPM) + Writing rubric
-- ─────────────────────────────────────────────────────────────────
-- Extends existing surfaces instead of adding new tables:
--
--   • user_read_history.read_seconds  — populated when the reader
--     closes the article. WPM is computed client-side from the
--     article word count. Feeds the Learning Hub Reading axis.
--
--   • finish_read_event RPC — called on reader exit. Marks the most
--     recent row complete and stamps read_seconds atomically.
--
--   • Writing rubric lives INSIDE the existing user_submissions.ai_feedback
--     JSON (new keys: rubric.accuracy / lexical_range / cohesion /
--     coherence). No new column is needed — JSON already holds the
--     Claude response. A GENERATED COLUMN exposes the rubric average
--     for cheap aggregation in the Learning Hub writing axis.
-- ═════════════════════════════════════════════════════════════════

-- 1) Reading elapsed time on user_read_history
ALTER TABLE public.user_read_history
  ADD COLUMN IF NOT EXISTS read_seconds int;

-- 2) finish_read_event — call with exactly the same (content_type,
--    content_id) pair the open-time log_read_event used. Stamps the
--    elapsed time + completion on the most recent matching row.
CREATE OR REPLACE FUNCTION public.finish_read_event(
  p_content_type text,
  p_content_id   text,
  p_read_seconds int,
  p_word_count   int DEFAULT NULL
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
  IF p_read_seconds IS NULL OR p_read_seconds < 0 THEN p_read_seconds := 0; END IF;
  -- Cap absurd dwell times (tab left open for hours) to 30 min so
  -- the average WPM isn't pulled toward zero by idle sessions.
  IF p_read_seconds > 1800 THEN p_read_seconds := 1800; END IF;

  SELECT id INTO v_id
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = p_content_type
      AND content_id   = p_content_id
    ORDER BY read_at DESC
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_event');
  END IF;

  UPDATE public.user_read_history
    SET read_seconds = GREATEST(COALESCE(read_seconds, 0), p_read_seconds),
        word_count   = COALESCE(p_word_count, word_count),
        completed    = true
    WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'read_seconds', p_read_seconds);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) FROM public;
GRANT  EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) TO authenticated;

-- 3) Quick aggregation helper — avg WPM from recent completed reads.
--    Used by the Learning Hub reading-axis scorer.
CREATE OR REPLACE FUNCTION public.get_recent_wpm(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_avg numeric;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('wpm', 0, 'samples', 0); END IF;

  SELECT COUNT(*), AVG(word_count::numeric / NULLIF(read_seconds, 0) * 60)
    INTO v_cnt, v_avg
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = 'article'
      AND completed = true
      AND read_seconds IS NOT NULL
      AND read_seconds >= 10      -- Ignore bounces
      AND word_count   IS NOT NULL
      AND word_count   > 20
      AND read_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'wpm',     COALESCE(ROUND(v_avg), 0),
    'samples', COALESCE(v_cnt, 0)
  );
END;
$$;

-- Needs word_count on user_read_history; add if missing.
ALTER TABLE public.user_read_history
  ADD COLUMN IF NOT EXISTS word_count int;

REVOKE EXECUTE ON FUNCTION public.get_recent_wpm(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_wpm(int) TO authenticated;

-- 4) Writing rubric aggregation — averages the rubric subscores
--    stored inside user_submissions.ai_feedback JSON over the last N
--    days of AI-reviewed writings. Returns 0 if the user hasn't
--    submitted anything, letting the Learning Hub gracefully fall
--    back to its old count-based heuristic.
CREATE OR REPLACE FUNCTION public.get_recent_writing_rubric(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc numeric; v_lex numeric; v_coh1 numeric; v_coh2 numeric;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('samples', 0); END IF;

  SELECT
    COUNT(*),
    AVG((ai_feedback->'rubric'->>'accuracy')::numeric),
    AVG((ai_feedback->'rubric'->>'lexical_range')::numeric),
    AVG((ai_feedback->'rubric'->>'cohesion')::numeric),
    AVG((ai_feedback->'rubric'->>'coherence')::numeric)
  INTO v_cnt, v_acc, v_lex, v_coh1, v_coh2
  FROM public.user_submissions
  WHERE user_id = v_uid
    AND content_type = 'writing'
    AND ai_feedback IS NOT NULL
    AND ai_feedback ? 'rubric'
    AND submitted_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'samples',       COALESCE(v_cnt, 0),
    'accuracy',      COALESCE(ROUND(v_acc), 0),
    'lexical_range', COALESCE(ROUND(v_lex), 0),
    'cohesion',      COALESCE(ROUND(v_coh1), 0),
    'coherence',     COALESCE(ROUND(v_coh2), 0),
    'overall',       COALESCE(ROUND((v_acc + v_lex + v_coh1 + v_coh2) / 4.0), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_recent_writing_rubric(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_writing_rubric(int) TO authenticated;

COMMENT ON FUNCTION public.finish_read_event(text, text, int, int) IS 'Called on reader close — stamps read_seconds + completed on the most recent open event';
COMMENT ON FUNCTION public.get_recent_wpm(int)                IS 'Average WPM over recent completed article reads (feeds Reading axis)';
COMMENT ON FUNCTION public.get_recent_writing_rubric(int)     IS 'Average rubric subscores from ai_feedback.rubric JSON (feeds Writing axis)';


-- ── from 20260424_writing_rubric_register.sql ──
-- ═════════════════════════════════════════════════════════════════
-- Phase 4 — Writing rubric: 5th axis "register"
-- ─────────────────────────────────────────────────────────────────
-- Phase 1 rolled up the rubric as (accuracy + lexical_range + cohesion
-- + coherence) / 4. Phase 4 adds `register` as a 5th axis. Rebuilds
-- the aggregator so:
--   • Newer submissions with register → averaged across all 5
--   • Older submissions without register → averaged across 4 (no penalty)
-- Also returns the register score independently so the UI can show it.
-- ═════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_recent_writing_rubric(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc numeric; v_lex numeric; v_coh1 numeric; v_coh2 numeric; v_reg numeric;
  v_cnt int; v_reg_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('samples', 0); END IF;

  SELECT
    COUNT(*),
    AVG((ai_feedback->'rubric'->>'accuracy')::numeric),
    AVG((ai_feedback->'rubric'->>'lexical_range')::numeric),
    AVG((ai_feedback->'rubric'->>'cohesion')::numeric),
    AVG((ai_feedback->'rubric'->>'coherence')::numeric),
    AVG((ai_feedback->'rubric'->>'register')::numeric),
    COUNT(*) FILTER (WHERE ai_feedback->'rubric' ? 'register')
  INTO v_cnt, v_acc, v_lex, v_coh1, v_coh2, v_reg, v_reg_cnt
  FROM public.user_submissions
  WHERE user_id = v_uid
    AND content_type IN ('writing', 'daily_package')
    AND ai_feedback IS NOT NULL
    AND ai_feedback ? 'rubric'
    AND submitted_at >= (now() - (p_days || ' days')::interval);

  -- If we have enough register samples, roll 5 axes. Otherwise keep the
  -- 4-axis overall so old data isn't falsely dragged down by COALESCE(0).
  DECLARE
    v_overall numeric;
  BEGIN
    IF v_reg_cnt >= 1 AND v_reg IS NOT NULL THEN
      v_overall := (COALESCE(v_acc,0) + COALESCE(v_lex,0) + COALESCE(v_coh1,0)
                  + COALESCE(v_coh2,0) + v_reg) / 5.0;
    ELSE
      v_overall := (COALESCE(v_acc,0) + COALESCE(v_lex,0) + COALESCE(v_coh1,0)
                  + COALESCE(v_coh2,0)) / 4.0;
    END IF;

    RETURN jsonb_build_object(
      'samples',         COALESCE(v_cnt, 0),
      'register_samples',COALESCE(v_reg_cnt, 0),
      'accuracy',        COALESCE(ROUND(v_acc),  0),
      'lexical_range',   COALESCE(ROUND(v_lex),  0),
      'cohesion',        COALESCE(ROUND(v_coh1), 0),
      'coherence',       COALESCE(ROUND(v_coh2), 0),
      'register',        COALESCE(ROUND(v_reg),  0),
      'overall',         COALESCE(ROUND(v_overall), 0)
    );
  END;
END;
$$;

COMMENT ON FUNCTION public.get_recent_writing_rubric(int) IS 'Average rubric subscores from ai_feedback.rubric JSON (5 axes when register data is present; falls back to 4 axes for older submissions)';


-- ── from 20260423_speaking_scores.sql ──
-- ═════════════════════════════════════════════════════════════════
-- Phase 2 — Speaking scores (Web Speech API)
-- ─────────────────────────────────────────────────────────────────
-- The existing 🎙️ record flow in the writing modal now also captures
-- a Speech-to-Text transcript via the browser's SpeechRecognition.
-- Two scores are derived client-side:
--
--   pronunciation  0-100   = char-level similarity (target ↔ STT)
--   fluency_wpm    int     = words spoken / minute of recording
--
-- Both scores ride inside user_submissions for both AI-only and coach
-- submissions, in a JSONB column shaped:
--
--   { pronunciation: 87, fluency_wpm: 142, fluency_score: 78,
--     transcript: "...", target: "...", duration_ms: 6200,
--     filler_count: 1, model: 'web-speech-api' }
-- ═════════════════════════════════════════════════════════════════

ALTER TABLE public.user_submissions
  ADD COLUMN IF NOT EXISTS speaking_scores jsonb;

-- Cheap aggregation for the Learning Hub Speaking axis. Averages the
-- last N days of speaking submissions; returns a single 0-100 number
-- per metric plus a sample count so the UI can fall back gracefully.
CREATE OR REPLACE FUNCTION public.get_recent_speaking_scores(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_cnt          int;
  v_pron         numeric;
  v_flu_score    numeric;
  v_flu_wpm      numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('samples', 0); END IF;

  SELECT
    COUNT(*),
    AVG((speaking_scores->>'pronunciation')::numeric),
    AVG((speaking_scores->>'fluency_score')::numeric),
    AVG((speaking_scores->>'fluency_wpm')::numeric)
  INTO v_cnt, v_pron, v_flu_score, v_flu_wpm
  FROM public.user_submissions
  WHERE user_id = v_uid
    AND content_type = 'speaking'
    AND speaking_scores IS NOT NULL
    AND speaking_scores ? 'pronunciation'
    AND submitted_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'samples',       COALESCE(v_cnt, 0),
    'pronunciation', COALESCE(ROUND(v_pron),      0),
    'fluency_score', COALESCE(ROUND(v_flu_score), 0),
    'fluency_wpm',   COALESCE(ROUND(v_flu_wpm),   0),
    'overall',       COALESCE(ROUND((v_pron + v_flu_score) / 2.0), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_recent_speaking_scores(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_speaking_scores(int) TO authenticated;

-- Add the 6th axis to the weekly snapshot table so historical
-- comparisons include Speaking. Defaults to 0 for old rows.
DO $$ BEGIN
  IF to_regclass('public.user_weekly_snapshot') IS NOT NULL THEN
    ALTER TABLE public.user_weekly_snapshot ADD COLUMN IF NOT EXISTS skill_speaking int NOT NULL DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN public.user_submissions.speaking_scores IS 'Web-Speech-API derived: { pronunciation, fluency_wpm, fluency_score, transcript, target, duration_ms, filler_count, model }';
COMMENT ON FUNCTION public.get_recent_speaking_scores(int) IS 'Average pronunciation + fluency over recent speaking submissions; feeds the Learning Hub Speaking axis';


-- ── from 20260423_placement_test_per_area.sql ──
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


-- ── from 20260517_essential_expressions.sql ──
-- essential_expressions: pool of high-value Korean phrases / idioms /
-- formulas learners should encounter repeatedly in conversation.
--
-- Design: separate from hover_vocab_master / vocabulary_bank because
-- those are dictionary entries (single words / definitions). Essential
-- expressions are MULTI-WORD chunks with a usage context — "잘
-- 부탁드립니다", "신경 써주셔서 감사해요", "큰일 났어요". They get
-- woven into generated conversations by the conv-gen prompt, so
-- learners hit the same expressions naturally over many scenes
-- instead of memorizing isolated lists.
--
-- Per owner: "필수표현같은거 Db 만들어서 대화에 포함시키는걸로 가보자".
--
-- RLS: anon read active rows; admin writes via service role (admin
-- UI lands in a follow-up PR).

CREATE TABLE IF NOT EXISTS public.essential_expressions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ko            text NOT NULL,
  en            text NOT NULL,
  level         text NOT NULL,             -- 's' | 'b' | 'i' | 'a'
  category      text,                      -- greeting | gratitude | apology | agreement | request | emotion | filler | etc.
  context_hint  text,                      -- when/how to use, optional
  sort_order    int  NOT NULL DEFAULT 100,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS essential_expressions_level_active_idx
  ON public.essential_expressions (level, active, sort_order);

ALTER TABLE public.essential_expressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "essential_expressions public read" ON public.essential_expressions;
CREATE POLICY "essential_expressions public read"
  ON public.essential_expressions FOR SELECT TO public
  USING (active = true);

-- Seed: ~40 high-value expressions across Beginner → Advanced. Picked
-- to cover the conversational glue learners need across the cat
-- buckets (everyday / work / friends / family / dating). Admin can
-- add / edit / disable via the management UI.
INSERT INTO public.essential_expressions (ko, en, level, category, context_hint, sort_order) VALUES
  -- Beginner — greeting / closing / acknowledgement
  ('잘 부탁드립니다',          'Please take care of me / Looking forward to working with you',  'b', 'greeting',   'First meeting, joining a team, asking for help',  10),
  ('수고하셨습니다',           'Good work / Thanks for your effort',                            'b', 'closing',    'End of a workday or task',                        20),
  ('괜찮아요',                  'It''s okay / No worries',                                       'b', 'reassurance',NULL,                                              30),
  ('맞아요',                    'That''s right',                                                 'b', 'agreement',  NULL,                                              40),
  ('아니에요',                  'No / Not at all',                                               'b', 'denial',     'Polite deflection of thanks or compliment',       50),
  ('그래요',                    'Really? / Is that so?',                                         'b', 'agreement',  NULL,                                              60),
  ('잠깐만요',                  'Hold on a moment',                                              'b', 'request',    NULL,                                              70),
  ('죄송합니다',                'I''m sorry (formal)',                                           'b', 'apology',    NULL,                                              80),
  ('미안해요',                  'Sorry (casual)',                                                'b', 'apology',    NULL,                                              90),
  ('고마워요',                  'Thanks (casual)',                                               'b', 'gratitude',  NULL,                                             100),
  -- Intermediate — emotion / opinion / softening
  ('신경 써주셔서 감사해요',     'Thanks for thinking of me',                                     'i', 'gratitude',  'Acknowledging a small kindness',                 110),
  ('덕분이에요',                'Thanks to you / Because of you',                                'i', 'gratitude',  NULL,                                             120),
  ('큰일 났어요',               'Something terrible happened / Big problem',                     'i', 'emotion',    'Reacting to bad news, exaggeration ok',          130),
  ('어쩔 수 없어요',            'There''s nothing we can do / It can''t be helped',              'i', 'resignation',NULL,                                             140),
  ('마음에 들어요',             'I like it (it suits my taste)',                                 'i', 'opinion',    NULL,                                             150),
  ('그럴 줄 알았어요',           'I knew it would be like that',                                  'i', 'reaction',   NULL,                                             160),
  ('생각해 볼게요',             'I''ll think about it',                                          'i', 'softening',  'Polite non-commitment',                          170),
  ('아무래도',                  'Probably / It seems like',                                      'i', 'filler',     'Softening a guess or opinion',                   180),
  ('그러게요',                  'Yeah, I know (agreeing with frustration)',                      'i', 'agreement',  NULL,                                             190),
  ('말도 안 돼요',              'No way / That doesn''t make sense',                             'i', 'reaction',   'Shock or disbelief',                             200),
  ('어차피',                    'Anyway / In any case',                                          'i', 'filler',     NULL,                                             210),
  ('그건 그렇고',               'By the way / Anyway',                                           'i', 'transition', 'Changing topic',                                  220),
  ('혹시',                      'By any chance',                                                 'i', 'softening',  'Polite question opener',                          230),
  ('일단',                      'For now / First',                                               'i', 'filler',     NULL,                                             240),
  ('아무튼',                    'Anyway / Anyhow',                                               'i', 'transition', NULL,                                             250),
  -- Advanced — idioms / nuanced
  ('하늘이 무너져도',            'Even if the sky falls (no matter what)',                        'a', 'idiom',      'Strong determination',                            260),
  ('발 없는 말이 천 리 간다',    'Rumors travel fast (lit. words with no feet travel 1000 miles)','a', 'idiom',      NULL,                                             270),
  ('티끌 모아 태산',             'Many a little makes a mickle',                                  'a', 'idiom',      NULL,                                             280),
  ('백문이 불여일견',            'Seeing once is better than hearing a hundred times',            'a', 'idiom',      NULL,                                             290),
  ('소 잃고 외양간 고친다',      'Locking the barn after the horse is stolen',                    'a', 'idiom',      NULL,                                             300),
  ('숨이 막혀요',               'It''s suffocating (emotionally overwhelming)',                  'a', 'emotion',    NULL,                                             310),
  ('차마 못 하겠어요',           'I can''t bring myself to do it',                                'a', 'emotion',    NULL,                                             320),
  ('한숨이 나와요',             'I can''t help sighing',                                         'a', 'emotion',    NULL,                                             330),
  ('속이 타요',                 'I''m anxious (lit. my insides burn)',                           'a', 'emotion',    NULL,                                             340),
  ('가슴이 뭉클해요',           'My heart feels touched',                                        'a', 'emotion',    NULL,                                             350),
  -- Filler / connector (any level, conversational glue)
  ('그러니까',                  'So / That''s why',                                              'b', 'filler',     NULL,                                             360),
  ('근데',                      'But / By the way (casual)',                                     'b', 'filler',     NULL,                                             370),
  ('역시',                      'As expected / Indeed',                                          'i', 'reaction',   NULL,                                             380),
  ('하긴',                      'Well, yeah / Come to think of it',                              'i', 'agreement',  'Reluctant agreement',                            390),
  ('그래도',                    'Still / Even so',                                               'b', 'transition', NULL,                                             400)
ON CONFLICT DO NOTHING;




-- ── New: objects the frontend uses that never had a migration ──

-- Growth Lab Daily Review score log (korehan-learning-overview.html).
CREATE TABLE IF NOT EXISTS public.daily_reviews (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  score      jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_reviews_own ON public.daily_reviews;
CREATE POLICY daily_reviews_own ON public.daily_reviews
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admin coin-adjustment audit log (admin CMS → user coins).
CREATE TABLE IF NOT EXISTS public.coin_adjustments (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delta       int NOT NULL,
  reason      text,
  new_balance bigint,
  admin_by    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coin_adjustments_admin ON public.coin_adjustments;
CREATE POLICY coin_adjustments_admin ON public.coin_adjustments
  FOR ALL USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());

-- Word Book SRS (korehan-learn.html): one more review on a saved word.
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS srs_review_count int DEFAULT 0;
CREATE OR REPLACE FUNCTION public.increment_srs_review_count(p_user_id uuid, p_word_ko text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.saved_words
     SET srs_review_count = COALESCE(srs_review_count, 0) + 1
   WHERE user_id = p_user_id AND p_user_id = auth.uid() AND word_ko = p_word_ko;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_srs_review_count(uuid, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.increment_srs_review_count(uuid, text) TO authenticated;

-- Fast Track play counter (Study Room).
DO $$ BEGIN
  IF to_regclass('public.fast_track_scenarios') IS NOT NULL THEN
    ALTER TABLE public.fast_track_scenarios ADD COLUMN IF NOT EXISTS play_count int NOT NULL DEFAULT 0;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.increment_ft_play_count(p_user_id uuid, p_scenario_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN RETURN; END IF;
  EXECUTE 'UPDATE public.fast_track_scenarios SET play_count = COALESCE(play_count, 0) + 1 WHERE id::text = $1'
    USING p_scenario_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_ft_play_count(uuid, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.increment_ft_play_count(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
