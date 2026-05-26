-- ─────────────────────────────────────────────────────────────────────
-- Audit 7 (Analytics) — AN-F11: redact PII from user_quiz_results.details
-- ─────────────────────────────────────────────────────────────────────
-- `user_quiz_results` is an analytics table tracking score / accuracy /
-- wrong_patterns / etc. across all game types. The speaking_feedback
-- code path was writing `details.transcript` containing up to 200
-- characters of the user's spoken Korean — direct PII (audio source,
-- personal sentences, sometimes location / health / relationship
-- content). That content already lives in `user_submissions.context_data`
-- which has explicit RLS + deletion paths, so the analytics-table
-- copy was both:
--   a) a duplicate the user can't easily inspect or delete, AND
--   b) a PIPA "right to erasure" liability — deleting one row
--      requires hunting through analytics surfaces too.
--
-- The frontend (korehan-study-room.js:8625) no longer writes
-- `transcript` — it now stores `transcript_len` instead so we keep
-- the correlation signal without retaining content. This migration
-- scrubs the historical rows.
--
-- Idempotent: jsonb `- 'transcript'` is a no-op if the key isn't
-- present, and the WHERE filter skips rows that have already been
-- scrubbed by an earlier run.
--
-- OWNER MUST APPLY this migration. Safe to re-run.

UPDATE public.user_quiz_results
   SET details = details - 'transcript'
 WHERE quiz_type = 'speaking_feedback'
   AND details ? 'transcript';

-- Optional defensive trigger to prevent any future regression from
-- silently re-introducing the field. Drops the `transcript` key on
-- INSERT and UPDATE so even if a buggy caller tries to write it,
-- the row lands clean. The frontend-side fix at korehan-study-room.js
-- :8625 is the real safeguard; this is belt-and-suspenders.
CREATE OR REPLACE FUNCTION public._scrub_quiz_transcript()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.details IS NOT NULL AND NEW.details ? 'transcript' THEN
    NEW.details := NEW.details - 'transcript';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_quiz_transcript_trigger ON public.user_quiz_results;
CREATE TRIGGER scrub_quiz_transcript_trigger
  BEFORE INSERT OR UPDATE ON public.user_quiz_results
  FOR EACH ROW
  EXECUTE FUNCTION public._scrub_quiz_transcript();

COMMENT ON FUNCTION public._scrub_quiz_transcript() IS
  'AN-F11 defensive scrub: strips details.transcript on INSERT/UPDATE so user-spoken Korean never reaches user_quiz_results (already lives in user_submissions.context_data with proper RLS).';
