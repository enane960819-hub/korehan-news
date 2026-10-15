-- auto-apply
-- finish_read_event ordered the user's open read events by
-- user_read_history.read_at, which does not exist (the column is created_at).
-- That 400'd the RPC on every article close, so reading time / completion was
-- never recorded and the Learning Hub Reading axis stayed empty for all users.
-- Same class as 20261013_fix_get_recent_wpm_read_at.sql (that one fixed
-- get_recent_wpm; finish_read_event was missed). Recreate with created_at.
-- Idempotent (CREATE OR REPLACE).

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
  v_id  bigint;
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
