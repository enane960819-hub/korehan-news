-- auto-apply
-- Fix: the nightly cron kh_purge_old_signup_pii failed every run (0/3 in the
-- 2026-10-24 health report). purge_old_signup_pii() required the
-- request JWT role to be 'service_role', but pg_cron calls it from a plain
-- database session with no JWT, so the guard rejected its own scheduler and
-- signup PII (email + name) was never purged — a PIPA Art 21 / GDPR
-- Art 5(1)(e) retention gap.
--
-- New guard: allow (a) the service_role JWT, or (b) a direct database
-- session (pg_cron / SQL editor), i.e. any session that did NOT arrive
-- through PostgREST (session_user 'authenticator'). API callers with an
-- anon/authenticated JWT are still refused, and EXECUTE is explicitly
-- revoked from those roles too. Idempotent.

CREATE OR REPLACE FUNCTION public.purge_old_signup_pii(p_age_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role   text := coalesce(current_setting('request.jwt.claim.role', true),
                            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'));
  v_purged int := 0;
BEGIN
  IF session_user = 'authenticator' AND v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'purge_old_signup_pii: service_role or a direct database session required';
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

  RETURN jsonb_build_object('ok', true, 'purged', v_purged, 'age_days', p_age_days, 'purged_at', now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_signup_pii(int) FROM public;
REVOKE EXECUTE ON FUNCTION public.purge_old_signup_pii(int) FROM anon, authenticated;
