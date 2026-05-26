-- ─────────────────────────────────────────────────────────────────────
-- Audit 7 (Analytics) — AN-F3: client_errors needs a `severity` column
-- ─────────────────────────────────────────────────────────────────────
-- The current client_errors table has no severity column, so the
-- admin Errors dashboard cannot distinguish a noisy ad-blocker-driven
-- unhandledrejection from a critical Stripe webhook signature failure
-- or an OAuth auth bypass. Without that distinction, alerting on
-- "any new client_errors row" produces too much noise to be useful,
-- so AN-F2 (Discord webhook on error insert) cannot land cleanly
-- until this is in place.
--
-- This migration is forward-compatible: existing rows get the default
-- 'error' value, and the CHECK constraint accepts the same 5-level
-- vocabulary as syslog / RFC 5424 (debug / info / warn / error /
-- critical). The frontend's kh_log_error() signature gains an
-- optional 3rd `severity` argument; calls without it continue to
-- write the default 'error'.
--
-- OWNER MUST APPLY THIS MIGRATION before the next deploy of
-- korehan-shared.js, because the new JS unconditionally writes the
-- `severity` field. Apply via Supabase SQL editor or `supabase db
-- push`. Idempotent — safe to re-run.

ALTER TABLE public.client_errors
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'error';

-- Enforce the controlled vocabulary. Wrap in DO so re-run is clean.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'client_errors_severity_check'
       AND conrelid = 'public.client_errors'::regclass
  ) THEN
    ALTER TABLE public.client_errors
      ADD CONSTRAINT client_errors_severity_check
      CHECK (severity IN ('debug','info','warn','error','critical'));
  END IF;
END $$;

-- Index for severity-filtered queries from the Errors dashboard
-- (e.g. "show me all critical rows from the last 24h"). Partial
-- index — only rows above 'warn' are interesting enough to query
-- by severity; the existing created_at_idx covers low-severity
-- bulk inspection.
CREATE INDEX IF NOT EXISTS client_errors_critical_idx
  ON public.client_errors (created_at DESC)
  WHERE severity IN ('error','critical');

COMMENT ON COLUMN public.client_errors.severity IS
  'syslog-style level. debug/info/warn → ignorable; error → default; critical → page admin (Discord webhook hooked off this in audit 8).';
