-- User blocks + account suspension
-- ================================================================
-- Two new moderation primitives.
--
-- 1) user_blocks — symmetric block list. When A blocks B:
--    - friendship row (if any) is dropped
--    - any pending friend_requests between them are cancelled
--    - subsequent send_friend_request from either side fails
--    - post_guestbook from B to A fails
--    - profile/comments rendering filters out the blocked user (UI side)
--
-- 2) profiles.is_suspended + reason + until — admin can disable an
--    account from posting/social actions. Read access is preserved
--    so the user can still log in and see their own data, but every
--    write RPC short-circuits with 'account_suspended'.

-- ── 1) Blocks table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ub_sel_own ON public.user_blocks;
CREATE POLICY ub_sel_own ON public.user_blocks
  FOR SELECT USING (auth.uid() IN (blocker_id, blocked_id));
DROP POLICY IF EXISTS ub_service_full ON public.user_blocks;
CREATE POLICY ub_service_full ON public.user_blocks
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Helper: directional block check.
CREATE OR REPLACE FUNCTION public.is_blocked(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = p_a AND blocked_id = p_b)
        OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated, anon;

-- ── 2) Block / unblock RPCs ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_user(p_target uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_low uuid; v_high uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_target IS NULL OR p_target = v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  -- Insert (or no-op) the block row.
  INSERT INTO public.user_blocks (blocker_id, blocked_id, reason)
    VALUES (v_user, p_target, p_reason)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Drop any friendship between them.
  v_low  := LEAST(v_user, p_target);
  v_high := GREATEST(v_user, p_target);
  DELETE FROM public.friendships WHERE low_id = v_low AND high_id = v_high;

  -- Cancel any pending friend requests in either direction.
  UPDATE public.friend_requests
     SET status = 'cancelled', resolved_at = now()
   WHERE status = 'pending'
     AND ((sender_id = v_user AND recipient_id = p_target)
       OR (sender_id = p_target AND recipient_id = v_user));

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.block_user(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  DELETE FROM public.user_blocks
   WHERE blocker_id = v_user AND blocked_id = p_target;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_blocked_users()
RETURNS TABLE (
  blocked_id   uuid,
  display_name text,
  blocked_at   timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.blocked_id, us.display_name, b.created_at
    FROM public.user_blocks b
    LEFT JOIN public.user_stats us ON us.user_id = b.blocked_id
   WHERE b.blocker_id = auth.uid()
   ORDER BY b.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_blocked_users() TO authenticated;

-- ── 3) Update social-write RPCs to honour blocks + suspension ──

-- Suspension columns on profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason  text,
  ADD COLUMN IF NOT EXISTS suspended_at      timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_until   timestamptz;

CREATE OR REPLACE FUNCTION public.is_account_suspended(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_suspended
       AND (suspended_until IS NULL OR suspended_until > now())
       FROM public.profiles WHERE id = p_user),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_account_suspended(uuid) TO authenticated, anon;

-- Replace send_friend_request with a version that respects blocks +
-- suspension. Keeps the existing mutual-pending auto-accept logic.
CREATE OR REPLACE FUNCTION public.send_friend_request(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_existing_to    public.friend_requests%ROWTYPE;
  v_existing_back  public.friend_requests%ROWTYPE;
  v_low uuid; v_high uuid;
  v_request_id uuid;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_target IS NULL OR p_target = v_sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;
  IF public.is_account_suspended(v_sender) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_suspended');
  END IF;
  IF public.is_blocked(v_sender, p_target) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'blocked');
  END IF;

  IF public.are_friends(v_sender, p_target) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_friends');
  END IF;

  SELECT * INTO v_existing_back FROM public.friend_requests
   WHERE sender_id = p_target AND recipient_id = v_sender AND status = 'pending'
   LIMIT 1;
  IF FOUND THEN
    v_low  := LEAST(v_sender, p_target);
    v_high := GREATEST(v_sender, p_target);
    UPDATE public.friend_requests
       SET status = 'accepted', resolved_at = now()
     WHERE id = v_existing_back.id;
    INSERT INTO public.friendships (low_id, high_id)
      VALUES (v_low, v_high)
      ON CONFLICT (low_id, high_id) DO NOTHING;
    INSERT INTO public.notifications (user_id, kind, payload)
      VALUES (p_target, 'friend_accepted', jsonb_build_object('friend_id', v_sender)),
             (v_sender, 'friend_accepted', jsonb_build_object('friend_id', p_target));
    RETURN jsonb_build_object('ok', true, 'status', 'accepted');
  END IF;

  SELECT * INTO v_existing_to FROM public.friend_requests
   WHERE sender_id = v_sender AND recipient_id = p_target AND status = 'pending'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_pending', 'request_id', v_existing_to.id);
  END IF;

  INSERT INTO public.friend_requests (sender_id, recipient_id)
    VALUES (v_sender, p_target)
    RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (p_target, 'friend_request', jsonb_build_object('from', v_sender, 'request_id', v_request_id));

  RETURN jsonb_build_object('ok', true, 'status', 'sent', 'request_id', v_request_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

-- Same hardening for the guestbook write path.
CREATE OR REPLACE FUNCTION public.post_guestbook(p_host uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author uuid := auth.uid();
  v_id uuid;
  v_msg text;
BEGIN
  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_host IS NULL OR p_host = v_author THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_host');
  END IF;
  IF public.is_account_suspended(v_author) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_suspended');
  END IF;
  IF public.is_blocked(v_author, p_host) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'blocked');
  END IF;
  v_msg := btrim(coalesce(p_message, ''));
  IF char_length(v_msg) = 0 OR char_length(v_msg) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_message');
  END IF;
  IF NOT public.are_friends(v_author, p_host) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_friends');
  END IF;
  INSERT INTO public.guestbook (host_id, author_id, message)
    VALUES (p_host, v_author, v_msg)
    RETURNING id INTO v_id;
  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (p_host, 'guestbook_post', jsonb_build_object('from', v_author, 'guestbook_id', v_id, 'preview', left(v_msg, 80)));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.post_guestbook(uuid, text) TO authenticated;

-- ── 4) Admin moderation RPCs ───────────────────────────────────
-- Allowlist + service_role can suspend / unsuspend any account. Frontend
-- calls hit through the admin-api edge function which already gates by
-- email; the RPC double-checks via the auth.email() lookup as a belt-
-- and-suspenders measure.
CREATE OR REPLACE FUNCTION public.admin_set_suspension(
  p_target  uuid,
  p_reason  text DEFAULT NULL,
  p_until   timestamptz DEFAULT NULL,
  p_active  boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  -- Email allowlist (mirror ADMIN_EMAILS in the edge function).
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL OR v_email <> 'enane960819@gmail.com' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_target IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  INSERT INTO public.profiles (id) VALUES (p_target) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles
     SET is_suspended      = p_active,
         suspended_reason  = CASE WHEN p_active THEN p_reason ELSE NULL END,
         suspended_at      = CASE WHEN p_active THEN now() ELSE NULL END,
         suspended_until   = CASE WHEN p_active THEN p_until ELSE NULL END,
         updated_at        = now()
   WHERE id = p_target;

  RETURN jsonb_build_object('ok', true, 'suspended', p_active);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(uuid, text, timestamptz, boolean) TO authenticated;
