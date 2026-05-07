-- Friends + Guestbook + In-App Notifications
-- ================================================================
-- Phase 1 of the social system.
--
-- Tables
--   friend_requests   pending requests sender → recipient
--   friendships       accepted bidirectional friend pairs (lower_id < higher_id)
--   guestbook         per-host wall posts (writable only by friends)
--   notifications    in-app inbox per user (read = unseen by recipient)
--
-- Identity
--   We key off auth.users.id for ownership and join to public.user_stats
--   for display_name lookups (already populated by syncUserStats).
--
-- Security model
--   RLS on every table. Reads are scoped to the authenticated user
--   except: user_stats remains public-read so anyone can see a profile
--   page; guestbook entries are public-read on the host's wall but only
--   writable by accepted friends; notifications are strictly per-user.
--
-- All write paths go through SECURITY DEFINER RPCs so the friendship
-- canonicalization (lower_id < higher_id), the friend-only guestbook
-- check, and the cross-user notification insert can run with the
-- definer's elevated privileges. No client SQL writes friendships
-- directly.

-- ── 1) Friend Requests ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  CHECK (sender_id <> recipient_id)
);

-- One outstanding request per direction. Lets a learner re-request
-- after a previous one was rejected or cancelled.
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique
  ON public.friend_requests (sender_id, recipient_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS friend_requests_recipient_idx
  ON public.friend_requests (recipient_id, status, created_at DESC);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fr_sel_own ON public.friend_requests;
CREATE POLICY fr_sel_own ON public.friend_requests
  FOR SELECT USING (auth.uid() IN (sender_id, recipient_id));
DROP POLICY IF EXISTS fr_service_full ON public.friend_requests;
CREATE POLICY fr_service_full ON public.friend_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 2) Friendships (accepted, canonical low/high pair) ───────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  low_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  high_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (low_id < high_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON public.friendships (low_id, high_id);
CREATE INDEX IF NOT EXISTS friendships_low_idx  ON public.friendships (low_id);
CREATE INDEX IF NOT EXISTS friendships_high_idx ON public.friendships (high_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
-- Reads visible to either side of the pair only.
DROP POLICY IF EXISTS fs_sel_own ON public.friendships;
CREATE POLICY fs_sel_own ON public.friendships
  FOR SELECT USING (auth.uid() IN (low_id, high_id));
DROP POLICY IF EXISTS fs_service_full ON public.friendships;
CREATE POLICY fs_service_full ON public.friendships
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Helper: are these two ids friends?
CREATE OR REPLACE FUNCTION public.are_friends(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (low_id = LEAST(p_a, p_b) AND high_id = GREATEST(p_a, p_b))
  );
$$;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, anon;

-- ── 3) Guestbook ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guestbook (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     text NOT NULL CHECK (char_length(btrim(message)) > 0 AND char_length(message) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (host_id <> author_id)
);

CREATE INDEX IF NOT EXISTS guestbook_host_idx
  ON public.guestbook (host_id, created_at DESC);

ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
-- Public read so any visitor can see the wall.
DROP POLICY IF EXISTS gb_public_read ON public.guestbook;
CREATE POLICY gb_public_read ON public.guestbook FOR SELECT USING (true);
-- Authors can delete their own messages; hosts can delete anything on
-- their wall.
DROP POLICY IF EXISTS gb_self_delete ON public.guestbook;
CREATE POLICY gb_self_delete ON public.guestbook
  FOR DELETE USING (auth.uid() IN (author_id, host_id));
DROP POLICY IF EXISTS gb_service_full ON public.guestbook;
CREATE POLICY gb_service_full ON public.guestbook
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- Inserts go through the post_guestbook RPC (security definer), no
-- client-side INSERT policy granted.

-- ── 4) Notifications (in-app inbox) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL
                 CHECK (kind IN ('friend_request','friend_accepted','guestbook_post','comment_reply','badge_earned','system')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_sel_own ON public.notifications;
CREATE POLICY notif_sel_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
-- Recipients can flip their own read_at via UPDATE so the bell badge
-- clears without needing the RPC round-trip.
DROP POLICY IF EXISTS notif_upd_own ON public.notifications;
CREATE POLICY notif_upd_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS notif_service_full ON public.notifications;
CREATE POLICY notif_service_full ON public.notifications
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────
-- RPCs
-- ────────────────────────────────────────────────────────────────

-- send_friend_request: sender = auth.uid(), recipient = p_target.
-- Idempotent on pending. Auto-accepts if the recipient already has a
-- pending request to the sender (mutual accept on second send).
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

  -- Already friends?
  IF public.are_friends(v_sender, p_target) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_friends');
  END IF;

  -- Reverse pending? Auto-accept.
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
    -- Notify both sides
    INSERT INTO public.notifications (user_id, kind, payload)
      VALUES (p_target, 'friend_accepted', jsonb_build_object('friend_id', v_sender)),
             (v_sender, 'friend_accepted', jsonb_build_object('friend_id', p_target));
    RETURN jsonb_build_object('ok', true, 'status', 'accepted');
  END IF;

  -- Existing forward pending? No-op.
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

-- accept_friend_request: recipient flips pending → accepted, creates
-- friendship row, notifies sender.
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req  public.friend_requests%ROWTYPE;
  v_low uuid; v_high uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_req.recipient_id <> v_user OR v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;
  v_low  := LEAST(v_req.sender_id, v_req.recipient_id);
  v_high := GREATEST(v_req.sender_id, v_req.recipient_id);
  UPDATE public.friend_requests
     SET status = 'accepted', resolved_at = now()
   WHERE id = p_request_id;
  INSERT INTO public.friendships (low_id, high_id)
    VALUES (v_low, v_high)
    ON CONFLICT (low_id, high_id) DO NOTHING;
  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (v_req.sender_id, 'friend_accepted', jsonb_build_object('friend_id', v_user));
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;

-- reject_friend_request / cancel_friend_request: same operation, both
-- flip the row to 'rejected' (or 'cancelled' if the sender is the one
-- backing out). No notification — the other side just sees the bell
-- count not change.
CREATE OR REPLACE FUNCTION public.reject_friend_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req  public.friend_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;
  IF v_user = v_req.recipient_id THEN
    UPDATE public.friend_requests SET status = 'rejected', resolved_at = now() WHERE id = p_request_id;
  ELSIF v_user = v_req.sender_id THEN
    UPDATE public.friend_requests SET status = 'cancelled', resolved_at = now() WHERE id = p_request_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_friend_request(uuid) TO authenticated;

-- post_guestbook: only friends of the host can write. Notifies host.
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

-- mark_notifications_read: set read_at = now() for the caller's
-- notifications. p_ids = null → mark all unread as read.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_ids IS NULL THEN
    UPDATE public.notifications SET read_at = now()
     WHERE user_id = v_user AND read_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE public.notifications SET read_at = now()
     WHERE user_id = v_user AND id = ANY(p_ids) AND read_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- get_friend_list: returns the caller's friends as user_stats rows so
-- the UI can render display_name/xp/streak in one shot.
CREATE OR REPLACE FUNCTION public.get_friend_list()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  xp int,
  streak int,
  articles_read int,
  words_saved int,
  since timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid)
  SELECT us.user_id::uuid,
         us.display_name,
         coalesce(us.xp, 0)::int,
         coalesce(us.streak, 0)::int,
         coalesce(us.articles_read, 0)::int,
         coalesce(us.words_saved, 0)::int,
         f.created_at AS since
    FROM public.friendships f
    JOIN me ON me.uid IN (f.low_id, f.high_id)
    JOIN public.user_stats us
      ON us.user_id = CASE WHEN me.uid = f.low_id THEN f.high_id ELSE f.low_id END
   ORDER BY f.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_friend_list() TO authenticated;

-- get_pending_friend_requests: list incoming pending requests for the
-- caller, joined to user_stats for the sender.
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests()
RETURNS TABLE (
  request_id uuid,
  sender_id uuid,
  display_name text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fr.id, fr.sender_id, us.display_name, fr.created_at
    FROM public.friend_requests fr
    LEFT JOIN public.user_stats us ON us.user_id = fr.sender_id
   WHERE fr.recipient_id = auth.uid()
     AND fr.status = 'pending'
   ORDER BY fr.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_pending_friend_requests() TO authenticated;
