-- ═════════════════════════════════════════════════════════════════════
-- Audit 13 batch B — Anthropic cost monitoring (PERF-F7 / F9 / F13)
-- ═════════════════════════════════════════════════════════════════════
-- Closes:
--   PERF-F7   No aggregate Anthropic budget alert / cost trend
--   PERF-F9   No per-feature cost rollup despite `feature` captured
--   PERF-F13  claude_api_usage has no retention policy
--
-- Adds:
--   claude_cost_daily              aggregated table (date, feature, model)
--   _kh_claude_price_usd()         pricing function (mirrors edge-fn TS)
--   aggregate_claude_costs_daily() incremental aggregator RPC
--   claude_cost_by_feature_month   materialized view for per-feature rollup
--   check_anthropic_budget_alert() threshold check → critical client_errors
--   purge_old_claude_api_usage()   retention (default 365d, min 90d)
--
-- DESIGN: all aggregation runs are MANUAL until CRON-F1 lands a
-- pg_cron scheduler. Admin UI has a "Run aggregation now" button.
-- When pg_cron is installed, schedule:
--   cron.schedule('claude_cost_daily',  '0 16 * * *', $$ select public.aggregate_claude_costs_daily(); $$)
--   cron.schedule('claude_cost_alert',  '5 16 * * *', $$ select public.check_anthropic_budget_alert(); $$)
--   cron.schedule('refresh_cost_view',  '10 16 * * *', $$ refresh materialized view concurrently public.claude_cost_by_feature_month; $$)
--   cron.schedule('purge_api_usage',    '0 17 * * 0', $$ select public.purge_old_claude_api_usage(); $$)
--
-- OWNER MUST APPLY this migration. Idempotent — safe to re-run.

-- ─── Pricing helper (mirrors claude-proxy/index.ts MODEL_PRICING) ───
-- Returns USD cost for a given (model, input_tokens, output_tokens).
-- Unknown models fall back to Sonnet pricing — same conservative
-- over-count rule the TS side uses.
CREATE OR REPLACE FUNCTION public._kh_claude_price_usd(
  p_model text,
  p_in_tokens int,
  p_out_tokens int
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_in_per_m  numeric;
  v_out_per_m numeric;
BEGIN
  IF p_model IS NULL THEN
    v_in_per_m := 3.00; v_out_per_m := 15.00;
  ELSE
    CASE p_model
      WHEN 'claude-opus-4-7'                THEN v_in_per_m := 15.00; v_out_per_m := 75.00;
      WHEN 'claude-sonnet-4-20250514'       THEN v_in_per_m :=  3.00; v_out_per_m := 15.00;
      WHEN 'claude-sonnet-4-6'              THEN v_in_per_m :=  3.00; v_out_per_m := 15.00;
      WHEN 'claude-3-sonnet-20240229'       THEN v_in_per_m :=  3.00; v_out_per_m := 15.00;
      WHEN 'claude-haiku-4-5-20251001'      THEN v_in_per_m :=  0.80; v_out_per_m :=  4.00;
      WHEN 'claude-haiku-4-5'               THEN v_in_per_m :=  0.80; v_out_per_m :=  4.00;
      ELSE v_in_per_m := 3.00; v_out_per_m := 15.00;
    END CASE;
  END IF;
  RETURN ROUND(
    (COALESCE(p_in_tokens, 0)::numeric * v_in_per_m / 1000000.0)
    + (COALESCE(p_out_tokens, 0)::numeric * v_out_per_m / 1000000.0),
    6
  );
END;
$$;

-- ─── Daily aggregate table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claude_cost_daily (
  date          date    NOT NULL,
  feature       text    NOT NULL DEFAULT '',
  model         text    NOT NULL DEFAULT '',
  calls         int     NOT NULL DEFAULT 0,
  input_tokens  bigint  NOT NULL DEFAULT 0,
  output_tokens bigint  NOT NULL DEFAULT 0,
  cost_usd      numeric NOT NULL DEFAULT 0,
  aggregated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, feature, model)
);

CREATE INDEX IF NOT EXISTS claude_cost_daily_date_idx
  ON public.claude_cost_daily (date DESC);

ALTER TABLE public.claude_cost_daily ENABLE ROW LEVEL SECURITY;

-- Admin-only read. Service-role / edge-function context bypasses RLS.
DROP POLICY IF EXISTS claude_cost_daily_admin_read ON public.claude_cost_daily;
CREATE POLICY claude_cost_daily_admin_read
  ON public.claude_cost_daily FOR SELECT
  USING (public.is_admin_email());

-- ─── Incremental aggregator ─────────────────────────────────────────
-- Aggregates yesterday + today from `claude_api_usage` into
-- claude_cost_daily. Idempotent (PRIMARY KEY upsert). Run daily
-- from cron OR manually from the admin "Run aggregation" button.
CREATE OR REPLACE FUNCTION public.aggregate_claude_costs_daily(
  p_days_back int DEFAULT 2
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start date;
  v_rows int;
BEGIN
  IF NOT public.is_admin_email() AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;
  v_start := (now() AT TIME ZONE 'Asia/Seoul')::date - GREATEST(0, p_days_back - 1);

  INSERT INTO public.claude_cost_daily (date, feature, model, calls, input_tokens, output_tokens, cost_usd)
  SELECT
    (created_at AT TIME ZONE 'Asia/Seoul')::date AS date,
    COALESCE(feature, '') AS feature,
    COALESCE(model, '')   AS model,
    COUNT(*)::int         AS calls,
    SUM(COALESCE(input_tokens,  0))::bigint AS input_tokens,
    SUM(COALESCE(output_tokens, 0))::bigint AS output_tokens,
    SUM(public._kh_claude_price_usd(model, input_tokens, output_tokens)) AS cost_usd
  FROM public.claude_api_usage
  WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date >= v_start
  GROUP BY 1, 2, 3
  ON CONFLICT (date, feature, model) DO UPDATE
    SET calls         = EXCLUDED.calls,
        input_tokens  = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        cost_usd      = EXCLUDED.cost_usd,
        aggregated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object(
    'ok', true,
    'aggregated_rows', v_rows,
    'from_date', v_start,
    'to_date', (now() AT TIME ZONE 'Asia/Seoul')::date
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aggregate_claude_costs_daily(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.aggregate_claude_costs_daily(int) TO authenticated;

-- ─── Materialized view: per-feature monthly rollup ──────────────────
-- For the admin "what's most expensive" question. Refresh nightly
-- via cron; admin button can REFRESH MATERIALIZED VIEW too.
DROP MATERIALIZED VIEW IF EXISTS public.claude_cost_by_feature_month;
CREATE MATERIALIZED VIEW public.claude_cost_by_feature_month AS
  SELECT
    date_trunc('month', date)::date AS month,
    feature,
    model,
    SUM(calls)::int         AS calls,
    SUM(input_tokens)::bigint AS input_tokens,
    SUM(output_tokens)::bigint AS output_tokens,
    SUM(cost_usd)            AS cost_usd
  FROM public.claude_cost_daily
  GROUP BY 1, 2, 3
  WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS claude_cost_by_feature_month_uk
  ON public.claude_cost_by_feature_month (month, feature, model);

-- Owner refreshes manually until cron: REFRESH MATERIALIZED VIEW
-- CONCURRENTLY public.claude_cost_by_feature_month;

-- ─── Budget alert ───────────────────────────────────────────────────
-- Checks month-to-date cost against `app_settings.anthropic_monthly_budget_usd`
-- (default $200 if not set) AND day-over-day spike (>3× rolling 7-day avg).
-- On breach: inserts critical client_errors row → fires the AN-F2
-- Discord notifier (once owner enables it).
CREATE OR REPLACE FUNCTION public.check_anthropic_budget_alert()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mtd        numeric;
  v_yesterday  numeric;
  v_avg7       numeric;
  v_budget     numeric;
  v_alert_msg  text;
  v_breach     boolean := false;
BEGIN
  IF NOT public.is_admin_email() AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_mtd
    FROM public.claude_cost_daily
   WHERE date >= date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul')::date);

  SELECT COALESCE(SUM(cost_usd), 0) INTO v_yesterday
    FROM public.claude_cost_daily
   WHERE date = (now() AT TIME ZONE 'Asia/Seoul')::date - 1;

  SELECT COALESCE(AVG(cost_usd), 0) INTO v_avg7
    FROM (
      SELECT date, SUM(cost_usd) AS cost_usd
        FROM public.claude_cost_daily
       WHERE date BETWEEN (now() AT TIME ZONE 'Asia/Seoul')::date - 8
                       AND (now() AT TIME ZONE 'Asia/Seoul')::date - 2
       GROUP BY date
    ) t;

  SELECT COALESCE((value)::numeric, 200) INTO v_budget
    FROM public.app_settings WHERE key = 'anthropic_monthly_budget_usd';

  IF v_mtd > v_budget THEN
    v_breach := true;
    v_alert_msg := format('Anthropic month-to-date $%s exceeds budget $%s',
                          to_char(v_mtd, 'FM999.00'), to_char(v_budget, 'FM999.00'));
  ELSIF v_avg7 > 0.5 AND v_yesterday > v_avg7 * 3 THEN
    v_breach := true;
    v_alert_msg := format('Anthropic daily spend $%s = %sx 7-day avg $%s',
                          to_char(v_yesterday, 'FM999.00'),
                          to_char(v_yesterday / NULLIF(v_avg7, 0), 'FM999.0'),
                          to_char(v_avg7, 'FM999.00'));
  END IF;

  IF v_breach THEN
    INSERT INTO public.client_errors (message, context, url, user_agent, severity)
    VALUES (
      v_alert_msg,
      jsonb_build_object(
        'source',     'check_anthropic_budget_alert',
        'mtd',        v_mtd,
        'budget',     v_budget,
        'yesterday',  v_yesterday,
        'avg7',       v_avg7
      ),
      NULL,
      'check_anthropic_budget_alert',
      'critical'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',        true,
    'breach',    v_breach,
    'mtd',       v_mtd,
    'budget',    v_budget,
    'yesterday', v_yesterday,
    'avg7',      v_avg7,
    'message',   v_alert_msg
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_anthropic_budget_alert() FROM public;
GRANT  EXECUTE ON FUNCTION public.check_anthropic_budget_alert() TO authenticated;

-- ─── PERF-F13: claude_api_usage retention ───────────────────────────
-- ~1k calls/day → 365k rows/year. Aggregator persists totals into
-- claude_cost_daily, so per-row history past ~12 months has limited
-- forensic value. Default 365d retention; admin can override.
CREATE OR REPLACE FUNCTION public.purge_old_claude_api_usage(p_keep_days int DEFAULT 365)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_purged int;
BEGIN
  IF NOT public.is_admin_email() AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;
  IF p_keep_days < 90 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'minimum retention is 90 days');
  END IF;

  DELETE FROM public.claude_api_usage
   WHERE created_at < now() - (p_keep_days || ' days')::interval;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'purged', v_purged, 'kept_days', p_keep_days);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_claude_api_usage(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.purge_old_claude_api_usage(int) TO authenticated;

COMMENT ON TABLE public.claude_cost_daily IS
  'PERF-F7: daily Anthropic cost rollup. Filled by aggregate_claude_costs_daily(). Survives claude_api_usage retention purge.';
COMMENT ON MATERIALIZED VIEW public.claude_cost_by_feature_month IS
  'PERF-F9: which feature is most expensive this month. Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY public.claude_cost_by_feature_month.';
COMMENT ON FUNCTION public.check_anthropic_budget_alert() IS
  'PERF-F7 alert side: month-to-date vs budget + 3x daily spike → critical client_errors row (= AN-F2 Discord ping).';
