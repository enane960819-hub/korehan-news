-- Pin search_path on every SECURITY DEFINER function in public
-- ================================================================
-- Without `SET search_path = public, pg_temp` (or a more restrictive
-- list), a SECURITY DEFINER function inherits whatever search_path
-- the caller has at invocation time. An attacker who can execute
-- arbitrary SQL (e.g. via a SQL injection in another path) can set
-- search_path to a schema they control, then call our RPC and have
-- it resolve `tbl_name` to their schema's object. Pinning the path
-- prevents that hijack.
--
-- Newer migrations on the branch (friends_notifications,
-- newsletter_v2, user_blocks_suspension, comment_reply_notify,
-- streak_freeze_award) already include `SET search_path = public`
-- on every CREATE FUNCTION. This patch sweeps any older
-- SECURITY DEFINER function still missing the setting.
--
-- Idempotent: ALTER FUNCTION on a function that already has the
-- setting just re-applies it.

DO $$
DECLARE
  v_fn record;
  v_proc_name text;
  v_args text;
BEGIN
  FOR v_fn IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    v_proc_name := quote_ident(v_fn.proname);
    EXECUTE format(
      'ALTER FUNCTION public.%s(%s) SET search_path = public, pg_temp',
      v_proc_name, v_fn.args
    );
    RAISE NOTICE 'pinned search_path on public.% (%) ', v_fn.proname, v_fn.args;
  END LOOP;
END
$$;
