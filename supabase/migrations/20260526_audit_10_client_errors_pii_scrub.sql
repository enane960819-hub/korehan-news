-- ─────────────────────────────────────────────────────────────────────
-- Audit 10 (GDPR + PIPA) — PRIV-F7: client_errors PII scrub on user delete
-- ─────────────────────────────────────────────────────────────────────
-- client_errors.user_id has `ON DELETE SET NULL` (see
-- 20260515_client_errors_table.sql:15) so when a user deletes their
-- account, the user_id column nulls out. But message / stack / context
-- / user_agent can still contain PII (failed-fetch URLs with the
-- user's email in query string, etc.) — those fields are NOT touched.
-- Result: orphaned rows with PII content tied to no user.
--
-- Two-layer fix (this migration is layer 2):
--   1. Frontend kh_log_error already runs _khScrubPII over message
--      and stack at insert time (regex scrub of UUIDs / emails /
--      JWTs / bearer tokens) — handles the common case.
--   2. (THIS MIGRATION) trigger that ALSO nulls stack / context /
--      user_agent when user_id transitions from NOT NULL → NULL
--      (i.e. the user_id FK cascade fired because auth.users was
--      deleted). Belt-and-suspenders for any PII that slipped past
--      the frontend scrubber.
--
-- The row itself is KEPT (status quo) so aggregate stats — "what's
-- the most common error type", "what user agents are breaking" —
-- still work post-deletion. Just stripped of identifying detail.
--
-- OWNER MUST APPLY this migration via Supabase SQL editor or
-- `supabase db push`. Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public._scrub_client_errors_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fires on UPDATE OF user_id. The FK's ON DELETE SET NULL action
  -- on auth.users deletion will set NEW.user_id = NULL while
  -- OLD.user_id was the actual UUID. In that exact transition we
  -- also null the surrounding PII-shaped columns.
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.stack      := NULL;
    NEW.user_agent := NULL;
    -- Keep context's keys (those are operator-defined feature tags
    -- like "feature: home_hero") but null any string values inside
    -- that could be PII. Simplest: nuke context entirely. The row
    -- still has message + severity + created_at for aggregation.
    NEW.context    := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_client_errors_on_user_delete_trigger ON public.client_errors;
CREATE TRIGGER scrub_client_errors_on_user_delete_trigger
  BEFORE UPDATE OF user_id ON public.client_errors
  FOR EACH ROW
  EXECUTE FUNCTION public._scrub_client_errors_on_user_delete();

COMMENT ON FUNCTION public._scrub_client_errors_on_user_delete() IS
  'PRIV-F7: when auth.users delete cascades user_id to NULL on client_errors, also null stack / user_agent / context to remove any orphaned PII. Row itself (message, severity, created_at) is kept for aggregate analytics.';
