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
ALTER TABLE public.user_weekly_snapshot
  ADD COLUMN IF NOT EXISTS skill_speaking int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_submissions.speaking_scores IS 'Web-Speech-API derived: { pronunciation, fluency_wpm, fluency_score, transcript, target, duration_ms, filler_count, model }';
COMMENT ON FUNCTION public.get_recent_speaking_scores(int) IS 'Average pronunciation + fluency over recent speaking submissions; feeds the Learning Hub Speaking axis';
