-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Sentence-analysis reports — learners flag a wrong / awkward analysis
-- ═════════════════════════════════════════════════════════════════════
-- The tap-to-analyze panel (articles + conversations) now has a
-- "🚩 Report" link. Reports land here and show up in the admin CMS
-- under "🧩 Analysis Reports", where the admin re-bakes / edits the
-- sentence and marks the report fixed.
--
-- OWNER MUST APPLY this migration (Supabase SQL editor). Idempotent.
-- Until it is applied the frontend falls back to logging the report
-- into client_errors (context.source = 'analysis-report'), so nothing
-- is lost in the meantime.

CREATE TABLE IF NOT EXISTS public.sentence_analysis_reports (
  id            bigserial PRIMARY KEY,
  content_type  text NOT NULL CHECK (content_type IN ('article','conversation')),
  content_id    text NOT NULL CHECK (length(content_id) BETWEEN 1 AND 100),
  sent_idx      integer,
  sentence      text NOT NULL CHECK (length(sentence) BETWEEN 1 AND 1000),
  reason        text NOT NULL CHECK (reason IN ('translation','grammar','vocab','awkward','other')),
  detail        text CHECK (detail IS NULL OR length(detail) <= 500),
  reporter_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','fixed','dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE INDEX IF NOT EXISTS sentence_analysis_reports_status_idx
  ON public.sentence_analysis_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sentence_analysis_reports_content_idx
  ON public.sentence_analysis_reports (content_type, content_id);
-- One pending report per (user, sentence). Re-reporting just updates it.
CREATE UNIQUE INDEX IF NOT EXISTS sentence_analysis_reports_pending_uq
  ON public.sentence_analysis_reports (content_type, content_id, sentence, reporter_id)
  WHERE status = 'pending';

ALTER TABLE public.sentence_analysis_reports ENABLE ROW LEVEL SECURITY;

-- Admin reads / resolves directly with the user-JWT client.
DROP POLICY IF EXISTS sar_admin_select ON public.sentence_analysis_reports;
CREATE POLICY sar_admin_select ON public.sentence_analysis_reports
  FOR SELECT USING (public.is_admin_email());
DROP POLICY IF EXISTS sar_admin_update ON public.sentence_analysis_reports;
CREATE POLICY sar_admin_update ON public.sentence_analysis_reports
  FOR UPDATE USING (public.is_admin_email()) WITH CHECK (public.is_admin_email());
DROP POLICY IF EXISTS sar_admin_delete ON public.sentence_analysis_reports;
CREATE POLICY sar_admin_delete ON public.sentence_analysis_reports
  FOR DELETE USING (public.is_admin_email());
-- No direct INSERT — goes through report_sentence_analysis().

CREATE OR REPLACE FUNCTION public.report_sentence_analysis(
  p_content_type text,
  p_content_id   text,
  p_sent_idx     integer,
  p_sentence     text,
  p_reason       text,
  p_detail       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today int;
  v_id bigint;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_content_type NOT IN ('article','conversation') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_content_type');
  END IF;
  IF p_reason NOT IN ('translation','grammar','vocab','awkward','other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;
  IF coalesce(btrim(p_content_id), '') = '' OR coalesce(btrim(p_sentence), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  -- Spam guard: 30 reports / user / 24h.
  SELECT count(*) INTO v_today FROM public.sentence_analysis_reports
   WHERE reporter_id = v_user AND created_at > now() - interval '24 hours';
  IF v_today >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.sentence_analysis_reports
    (content_type, content_id, sent_idx, sentence, reason, detail, reporter_id)
  VALUES
    (p_content_type, btrim(p_content_id), p_sent_idx, left(btrim(p_sentence), 1000),
     p_reason, nullif(left(btrim(coalesce(p_detail, '')), 500), ''), v_user)
  ON CONFLICT (content_type, content_id, sentence, reporter_id) WHERE status = 'pending'
  DO UPDATE SET reason = EXCLUDED.reason, detail = EXCLUDED.detail, created_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_sentence_analysis(text, text, integer, text, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.report_sentence_analysis(text, text, integer, text, text, text) TO authenticated;
