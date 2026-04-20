-- ═════════════════════════════════════════════════════════════════
-- Speaking Coach (Pro tier add-on)
-- ─────────────────────────────────────────────────────────────────
-- Adds a daily-coin economy for human coach review of speaking
-- submissions. Pro plan ($24.99/mo) gates eligibility; level decides
-- daily quota and per-submission character cap.
--
--   Seed / Sprout (Starter / Beginner) → 5 coins/day, 250 char max
--   Tree         (Intermediate)        → 10 coins/day, 500 char max
--   Forest       (Advanced)            → 0 coins (1:1 tutoring upsell)
--
-- One submission = one coin, regardless of duration. Carry-over is
-- capped at 3 days so coach inbox never gets a 30-day backlog.
-- ═════════════════════════════════════════════════════════════════

-- 1) Per-user balance + refresh tracking
CREATE TABLE IF NOT EXISTS public.user_speaking_coins (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_remaining    int  NOT NULL DEFAULT 0,
  last_refresh_date  date NOT NULL DEFAULT current_date,
  total_submitted    int  NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_speaking_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_speaking_coins_select_own"
  ON public.user_speaking_coins FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies — only the SECURITY DEFINER RPC writes here.

-- 2) Daily quota per level
CREATE OR REPLACE FUNCTION public._speaking_quota_for_level(p_level text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_level
    WHEN 'Starter'      THEN 5
    WHEN 'Beginner'     THEN 5
    WHEN 'Intermediate' THEN 10
    WHEN 'Advanced'     THEN 0
    ELSE 5
  END;
$$;

-- 3) Atomic refresh + consume. Returns:
--   { ok: true,  remaining: N }            on success
--   { ok: false, reason: 'no_coins',  remaining: N }
--   { ok: false, reason: 'forest_redirect' }
CREATE OR REPLACE FUNCTION public.consume_speaking_coin(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_today        date := current_date;
  v_quota        int;
  v_carry_max    int  := 3;   -- max days of unused coins to carry
  v_max_balance  int;
  v_row          public.user_speaking_coins%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_quota := public._speaking_quota_for_level(p_level);
  IF v_quota = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forest_redirect');
  END IF;
  v_max_balance := v_quota * (v_carry_max + 1);

  SELECT * INTO v_row
    FROM public.user_speaking_coins
    WHERE user_id = v_uid
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_speaking_coins (user_id, coins_remaining, last_refresh_date)
      VALUES (v_uid, v_quota, v_today)
      RETURNING * INTO v_row;
  ELSIF v_row.last_refresh_date < v_today THEN
    -- Add today's quota; cap at max_balance so 30-day skipper doesn't dump on the coach.
    UPDATE public.user_speaking_coins
      SET coins_remaining   = LEAST(coins_remaining + v_quota, v_max_balance),
          last_refresh_date = v_today,
          updated_at        = now()
      WHERE user_id = v_uid
      RETURNING * INTO v_row;
  END IF;

  IF v_row.coins_remaining <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_coins', 'remaining', 0);
  END IF;

  UPDATE public.user_speaking_coins
    SET coins_remaining = coins_remaining - 1,
        total_submitted = total_submitted + 1,
        updated_at      = now()
    WHERE user_id = v_uid
    RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'remaining', v_row.coins_remaining);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_speaking_coin(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.consume_speaking_coin(text) TO authenticated;

-- 4) Read current balance (without consuming) — used for UI badge.
CREATE OR REPLACE FUNCTION public.get_speaking_coin_balance(p_level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_quota  int  := public._speaking_quota_for_level(p_level);
  v_row    public.user_speaking_coins%ROWTYPE;
  v_today  date := current_date;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('remaining', 0, 'quota', v_quota); END IF;

  SELECT * INTO v_row FROM public.user_speaking_coins WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('remaining', v_quota, 'quota', v_quota, 'next_refresh', v_today + 1);
  END IF;

  -- Project today's quota if it would refresh on next consume.
  IF v_row.last_refresh_date < v_today THEN
    RETURN jsonb_build_object(
      'remaining',    LEAST(v_row.coins_remaining + v_quota, v_quota * 4),
      'quota',        v_quota,
      'next_refresh', v_today + 1
    );
  END IF;
  RETURN jsonb_build_object(
    'remaining',    v_row.coins_remaining,
    'quota',        v_quota,
    'next_refresh', v_today + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_speaking_coin_balance(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_speaking_coin_balance(text) TO authenticated;

-- 5) Mark `user_submissions` rows that came through the coach pipeline so
--    the admin queue can filter and the inbox can label them.
ALTER TABLE public.user_submissions
  ADD COLUMN IF NOT EXISTS speaking_coach_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_submissions_coach_queue_idx
  ON public.user_submissions (status, created_at)
  WHERE speaking_coach_review = true;

-- 6) Storage bucket for audio. Run in Supabase Dashboard → Storage if you
--    don't want to use the existing 'avatars' bucket:
--
--    Bucket name:  speaking-audio
--    Public:       false
--    File size:    10 MB
--    MIME types:   audio/webm, audio/mp4, audio/mpeg
--
--    RLS policies:
--    - INSERT: bucket_id='speaking-audio' AND (storage.foldername(name))[1] = auth.uid()::text
--    - SELECT: bucket_id='speaking-audio' AND ((storage.foldername(name))[1] = auth.uid()::text OR auth.jwt()->>'role'='admin')
--
-- For now the existing flow keeps writing to `avatars/speaking/<uid>/`,
-- which works because that bucket already has the right RLS for owner-
-- write/owner-read.

COMMENT ON TABLE  public.user_speaking_coins IS 'Pro Speaking Coach: per-user daily coin balance';
COMMENT ON FUNCTION public.consume_speaking_coin(text) IS 'Atomic refresh + consume — call when user submits a speaking item';
COMMENT ON FUNCTION public.get_speaking_coin_balance(text) IS 'Read-only balance for UI; returns projected post-refresh value if stale';
