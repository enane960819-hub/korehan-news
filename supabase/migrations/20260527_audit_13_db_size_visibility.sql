-- ═════════════════════════════════════════════════════════════════════
-- Audit 13 batch C — PERF-F15: Supabase free-tier usage visibility
-- ═════════════════════════════════════════════════════════════════════
-- Closes PERF-F15 from audit 13. Without any code-side visibility,
-- the project size crosses 500 MB (Free tier) silently and writes
-- start failing only when the dashboard already shows red.
--
-- Approach: admin-only SQL function that returns:
--   - total DB size
--   - top 20 tables by size (with row count)
--   - largest indexes
-- Surfaced in the admin "💵 Anthropic Cost Monitor" tab via a
-- new "DB usage" panel that shows the same info inline.
--
-- This is cheaper than the Supabase Management API route (which
-- needs a personal access token with broader scope than
-- service-role). Egress + function-invocations are not exposed
-- here; owner reads them from the Supabase dashboard directly —
-- worth a short doc note.
--
-- OWNER MUST APPLY this migration. Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.kh_db_size_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_bytes bigint;
  v_tables      jsonb;
  v_indexes     jsonb;
BEGIN
  IF NOT public.is_admin_email() AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;

  SELECT pg_database_size(current_database()) INTO v_total_bytes;

  -- Top 20 user tables by total size (heap + toast + indexes).
  SELECT jsonb_agg(t ORDER BY t.total_bytes DESC) INTO v_tables FROM (
    SELECT
      relname                                  AS table_name,
      pg_total_relation_size(C.oid)            AS total_bytes,
      pg_relation_size(C.oid)                  AS heap_bytes,
      pg_indexes_size(C.oid)                   AS index_bytes,
      pg_total_relation_size(C.oid) - pg_relation_size(C.oid) - pg_indexes_size(C.oid) AS toast_bytes,
      (SELECT reltuples::bigint FROM pg_class WHERE oid = C.oid) AS approx_rows
    FROM pg_class C
    LEFT JOIN pg_namespace N ON N.oid = C.relnamespace
    WHERE C.relkind = 'r'
      AND N.nspname = 'public'
    ORDER BY pg_total_relation_size(C.oid) DESC
    LIMIT 20
  ) t;

  -- Top 10 indexes by size — useful for spotting bloated /
  -- unused indexes that PERF-F1 / F2 / F3 added.
  SELECT jsonb_agg(i ORDER BY i.size_bytes DESC) INTO v_indexes FROM (
    SELECT
      indexrelname AS index_name,
      relname      AS on_table,
      pg_relation_size(i.indexrelid) AS size_bytes,
      idx_scan                       AS scans
    FROM pg_stat_user_indexes i
    WHERE schemaname = 'public'
    ORDER BY pg_relation_size(i.indexrelid) DESC
    LIMIT 10
  ) i;

  RETURN jsonb_build_object(
    'ok',           true,
    'total_bytes',  v_total_bytes,
    'total_mb',     ROUND(v_total_bytes / 1024.0 / 1024.0, 2),
    'free_tier_mb', 500,
    'tables',       COALESCE(v_tables, '[]'::jsonb),
    'indexes',      COALESCE(v_indexes, '[]'::jsonb),
    'measured_at',  now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kh_db_size_overview() FROM public;
GRANT  EXECUTE ON FUNCTION public.kh_db_size_overview() TO authenticated;

COMMENT ON FUNCTION public.kh_db_size_overview() IS
  'PERF-F15: admin DB-size visibility. Total bytes + top 20 tables + top 10 indexes. Surfaced in the admin Cost Monitor tab.';
