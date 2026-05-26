-- ═════════════════════════════════════════════════════════════════════
-- Audit 11 (Content moderation) — Reports + comment soft-delete
-- ═════════════════════════════════════════════════════════════════════
-- Closes:
--   MOD-F2  Report/flag pipeline (was localStorage-only)
--   MOD-F7  Comment hard-delete loses audit trail — soft-delete instead
--
-- New schema:
--   content_reports        a row per (reporter, target) flag
--   comments.deleted_at    soft-delete timestamp
--   comments.deleted_by    who removed it (self / admin)
--   comments.content_original  the text at deletion time (for admin review)
--
-- New RPCs:
--   report_content         user reports a piece of UGC
--   soft_delete_comment    own delete OR admin delete; preserves audit
--   admin_resolve_report   admin resolves a report queue row
--
-- OWNER MUST APPLY this migration. Idempotent — safe to re-run.

-- ─── 1. content_reports table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id            bigserial PRIMARY KEY,
  target_type   text NOT NULL CHECK (target_type IN (
                  'comment','guestbook','profile','reporter_post','user_submission'
                )),
  target_id     text NOT NULL,
  -- Capture both who reported and (for comments) who authored, so
  -- the admin queue can join without N extra round-trips. author_id
  -- may be NULL if the target is gone by the time admin reviews.
  reporter_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text NOT NULL CHECK (length(reason) BETWEEN 1 AND 100),
  detail        text CHECK (detail IS NULL OR length(detail) <= 500),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolver_note text CHECK (resolver_note IS NULL OR length(resolver_note) <= 500),
  -- Dedup: one user can't pile up duplicate reports against the
  -- same target. Re-report after resolution is fine because the
  -- partial index only applies to pending+reviewed rows.
  UNIQUE (target_type, target_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can read their OWN reports (transparency). Admin sees all
-- via service-role / x-admin-bypass.
DROP POLICY IF EXISTS content_reports_select_own ON public.content_reports;
CREATE POLICY content_reports_select_own
  ON public.content_reports FOR SELECT
  USING (reporter_id = auth.uid() OR public.is_admin_email());

-- No direct INSERT — goes through report_content RPC.
-- No direct UPDATE — goes through admin_resolve_report RPC.

-- ─── 2. Soft-delete columns on comments ─────────────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS deleted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_original  text;

-- Partial index: most reads filter out soft-deleted rows. The
-- aggregate index isn't worth it; the existing article_id index
-- already covers the listing path.
CREATE INDEX IF NOT EXISTS comments_active_idx
  ON public.comments (article_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 3. report_content RPC ──────────────────────────────────────────
-- User-facing endpoint. Inserts a content_reports row, looks up the
-- target's author so the admin queue can render without a join.
CREATE OR REPLACE FUNCTION public.report_content(
  p_target_type text,
  p_target_id   text,
  p_reason      text,
  p_detail      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_author uuid;
  v_id bigint;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_target_type NOT IN ('comment','guestbook','profile','reporter_post','user_submission') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_type');
  END IF;
  IF p_target_id IS NULL OR length(btrim(p_target_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target_id');
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 OR length(p_reason) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  -- Best-effort author lookup. If the target table doesn't exist or
  -- the row is gone, we still create the report — admin can resolve
  -- it as 'dismissed' with author_id = NULL.
  v_author := NULL;
  BEGIN
    IF p_target_type = 'comment' THEN
      SELECT user_id INTO v_author FROM public.comments WHERE id::text = p_target_id;
    ELSIF p_target_type = 'guestbook' THEN
      SELECT author_id INTO v_author FROM public.guestbook WHERE id::text = p_target_id;
    ELSIF p_target_type = 'profile' THEN
      v_author := p_target_id::uuid;
    ELSIF p_target_type = 'reporter_post' THEN
      SELECT author_user_id INTO v_author FROM public.reporter_posts WHERE id::text = p_target_id;
    ELSIF p_target_type = 'user_submission' THEN
      SELECT user_id INTO v_author FROM public.user_submissions WHERE id::text = p_target_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_author := NULL;
  END;

  -- Don't allow self-reporting.
  IF v_author IS NOT NULL AND v_author = v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_report_self');
  END IF;

  INSERT INTO public.content_reports
    (target_type, target_id, reporter_id, author_id, reason, detail)
    VALUES (p_target_type, p_target_id, v_user, v_author, btrim(p_reason), p_detail)
    ON CONFLICT (target_type, target_id, reporter_id) DO UPDATE
    SET reason  = EXCLUDED.reason,
        detail  = EXCLUDED.detail,
        status  = 'pending',
        created_at = now(),
        resolved_at = NULL,
        resolved_by = NULL,
        resolver_note = NULL
    RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_content(text, text, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.report_content(text, text, text, text) TO authenticated;

-- ─── 4. soft_delete_comment RPC ─────────────────────────────────────
-- Replaces the direct DELETE in comments.js. Owner (self) can
-- delete; admin can delete anyone's. Preserves the original text
-- in content_original so the admin queue can investigate harassment
-- after a self-delete.
CREATE OR REPLACE FUNCTION public.soft_delete_comment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.comments%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_id');
  END IF;
  v_is_admin := public.is_admin_email();

  SELECT * INTO v_row FROM public.comments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;
  IF v_row.user_id <> v_user AND NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.comments
     SET deleted_at        = now(),
         deleted_by        = v_user,
         content_original  = COALESCE(content_original, v_row.content),
         content           = CASE WHEN v_is_admin AND v_row.user_id <> v_user
                                  THEN '[Removed by moderator]'
                                  ELSE '[Deleted by author]'
                             END
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'by_admin', v_is_admin AND v_row.user_id <> v_user);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_comment(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.soft_delete_comment(uuid) TO authenticated;

-- ─── 5. admin_resolve_report RPC ────────────────────────────────────
-- Admin clicks "Dismiss" / "Hide content" / "Mark reviewed" in the
-- admin queue. If action='hide_comment', cascades into
-- soft_delete_comment for the target (only valid for target_type =
-- 'comment'; other surfaces TBD).
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id bigint,
  p_action    text,
  p_note      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_rpt  public.content_reports%ROWTYPE;
  v_new_status text;
BEGIN
  IF NOT public.is_admin_email() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;
  IF p_action NOT IN ('dismiss','reviewed','hide_comment') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_rpt FROM public.content_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_new_status := CASE p_action
    WHEN 'dismiss'      THEN 'dismissed'
    WHEN 'reviewed'     THEN 'reviewed'
    WHEN 'hide_comment' THEN 'actioned'
  END;

  -- If hiding a comment, cascade. Other surfaces TBD; admin can
  -- still mark 'actioned' via the 'reviewed' route + manual delete.
  IF p_action = 'hide_comment' THEN
    IF v_rpt.target_type <> 'comment' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'hide_only_for_comments');
    END IF;
    -- soft_delete_comment is SECURITY DEFINER and checks
    -- is_admin_email() via auth.uid(), so the cascade works.
    PERFORM public.soft_delete_comment(v_rpt.target_id::uuid);
  END IF;

  UPDATE public.content_reports
     SET status        = v_new_status,
         resolved_at   = now(),
         resolved_by   = v_user,
         resolver_note = p_note
   WHERE id = p_report_id;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(bigint, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_report(bigint, text, text) TO authenticated;

COMMENT ON TABLE public.content_reports IS
  'MOD-F2: user-submitted moderation reports. Pipeline: report_content RPC inserts → admin queue reads pending → admin_resolve_report RPC resolves.';
COMMENT ON COLUMN public.comments.content_original IS
  'MOD-F7: original comment text preserved at soft-delete time, so the admin queue can investigate harassment even after the harasser self-deletes.';
