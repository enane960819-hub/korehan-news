-- auto-apply
-- Second fix for finish_read_event. After 20261015_fix_finish_read_event_read_at
-- corrected read_at -> created_at, the SELECT started finding rows and exposed a
-- latent type bug: the function declared v_id as bigint, but user_read_history.id
-- is a uuid, so it failed with:
--   22P02 invalid input syntax for type bigint: "<uuid>"
-- (The original definition in 20261012_reapply_missing_objects.sql had this too;
-- it never surfaced because the read_at error aborted the function first.)
-- Recreate with v_id uuid. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.finish_read_event(
  p_content_type text,
  p_content_id   text,
  p_read_seconds int,
  p_word_count   int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_read_seconds IS NULL OR p_read_seconds < 0 THEN p_read_seconds := 0; END IF;
  -- Cap absurd dwell times (tab left open for hours) to 30 min so
  -- the average WPM isn't pulled toward zero by idle sessions.
  IF p_read_seconds > 1800 THEN p_read_seconds := 1800; END IF;

  SELECT id INTO v_id
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = p_content_type
      AND content_id   = p_content_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_open_event');
  END IF;

  UPDATE public.user_read_history
    SET read_seconds = GREATEST(COALESCE(read_seconds, 0), p_read_seconds),
        word_count   = COALESCE(p_word_count, word_count),
        completed    = true
    WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'read_seconds', p_read_seconds);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) FROM public;
GRANT  EXECUTE ON FUNCTION public.finish_read_event(text, text, int, int) TO authenticated;
