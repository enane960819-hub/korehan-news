-- auto-apply
-- get_recent_wpm referenced user_read_history.read_at, which does not exist
-- (the column is created_at). That 400'd the Growth Lab WPM/Reading stat for
-- every signed-in user. Recreate the function with the correct column.
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.get_recent_wpm(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_avg numeric;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('wpm', 0, 'samples', 0); END IF;

  SELECT COUNT(*), AVG(word_count::numeric / NULLIF(read_seconds, 0) * 60)
    INTO v_cnt, v_avg
    FROM public.user_read_history
    WHERE user_id = v_uid
      AND content_type = 'article'
      AND completed = true
      AND read_seconds IS NOT NULL
      AND read_seconds >= 10      -- Ignore bounces
      AND word_count   IS NOT NULL
      AND word_count   > 20
      AND created_at >= (now() - (p_days || ' days')::interval);

  RETURN jsonb_build_object(
    'wpm',     COALESCE(ROUND(v_avg), 0),
    'samples', COALESCE(v_cnt, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_recent_wpm(int) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recent_wpm(int) TO authenticated;
