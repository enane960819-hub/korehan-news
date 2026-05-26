-- ─────────────────────────────────────────────────────────────────────
-- Audit 10 (GDPR + PIPA) — PRIV-F5: signup_notifications_log retention
-- ─────────────────────────────────────────────────────────────────────
-- The log holds email + name + provider + user_id for every signup
-- since 2026-04. PIPA Art 21 (delete-without-delay-when-purpose-met)
-- and GDPR Art 5(1)(e) (storage limitation) require a retention rule
-- — the admin uses this for a few days to see new signups, the data
-- is stale beyond that.
--
-- Without a cron scheduler (CRON-F1 still open), we provide a manual
-- purge procedure that nulls the email + name fields on rows older
-- than 90 days. The user_id + provider + webhook_status columns are
-- kept for long-term aggregate stats (no PII once email + name are
-- null'd). Owner runs it ad-hoc until pg_cron is installed; the
-- future cron migration just calls this function on a schedule.
--
-- OWNER MUST APPLY this migration via Supabase SQL editor or
-- `supabase db push`. Run the procedure manually with
-- `SELECT public.purge_old_signup_pii();` after applying it.
-- Idempotent — safe to re-run the migration.

CREATE OR REPLACE FUNCTION public.purge_old_signup_pii(p_age_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
  v_purged int := 0;
BEGIN
  -- Service-role only — exposed only to scheduled jobs / admin SQL.
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'purge_old_signup_pii: service_role required';
  END IF;
  IF p_age_days < 30 THEN
    RAISE EXCEPTION 'purge_old_signup_pii: minimum retention is 30 days';
  END IF;

  UPDATE public.signup_notifications_log
     SET email = NULL,
         name  = NULL
   WHERE created_at < now() - (p_age_days || ' days')::interval
     AND (email IS NOT NULL OR name IS NOT NULL);

  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',         true,
    'purged',     v_purged,
    'age_days',   p_age_days,
    'purged_at',  now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_signup_pii(int) FROM public;
-- service_role bypasses REVOKE; no GRANT to authenticated.

COMMENT ON FUNCTION public.purge_old_signup_pii(int) IS
  'PIPA Art 21 / GDPR Art 5(1)(e) retention. Nulls email + name on signup_notifications_log rows older than N days (default 90). Keeps user_id + provider + webhook_status for aggregate stats. Run manually until pg_cron is installed; future cron migration calls this on a schedule.';
