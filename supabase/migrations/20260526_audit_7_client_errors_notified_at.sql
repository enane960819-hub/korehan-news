-- ─────────────────────────────────────────────────────────────────────
-- Audit 7 (Analytics) — AN-F2: client_errors notification dedup column
-- ─────────────────────────────────────────────────────────────────────
-- Companion to 20260526_audit_7_client_errors_severity.sql and the
-- new notify-critical-error Edge Function. Adds a notified_at
-- timestamp so the function can dedup retries (a critical row gets
-- pushed to Discord exactly once, regardless of how many times the
-- frontend / webhook retries the notification fetch).
--
-- The notification path is: severity='critical' INSERT
--   → application captures the new row id via .select('id').single()
--   → application fires a fire-and-forget POST to
--     /functions/v1/notify-critical-error with {id: N}
--   → that function does
--       UPDATE client_errors
--         SET notified_at = now()
--         WHERE id = N AND severity = 'critical' AND notified_at IS NULL
--         RETURNING *;
--     and only POSTs to Discord if the UPDATE returned a row.
-- The single-statement UPDATE-RETURNING is atomic, so two concurrent
-- notify calls for the same id can't both win.
--
-- OWNER MUST APPLY this migration before the notify-critical-error
-- function is deployed. Idempotent — safe to re-run.

ALTER TABLE public.client_errors
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE INDEX IF NOT EXISTS client_errors_unnotified_critical_idx
  ON public.client_errors (created_at DESC)
  WHERE severity = 'critical' AND notified_at IS NULL;

COMMENT ON COLUMN public.client_errors.notified_at IS
  'When the notify-critical-error Edge Function pushed this row to the Discord webhook. NULL = not yet notified (or severity is below critical, which never gets pushed).';
