-- Admin alerts + notification kind audit + read-row auto-cleanup
-- ================================================================
-- Three changes in one migration, all bell-icon related:
--
-- 1. Expand notifications_kind_check to cover every kind the rendering
--    layer (korehan-shared.js _khRenderNotifItem) already knows about.
--    `feedback_received` was rendered but rejected at the constraint —
--    that's the user-reported "피드백 왔는데 알람 안떴는데". `admin_
--    cache_miss` is new (for the admin-only inbox below).
--
-- 2. notify_admin_cache_miss RPC. Authenticated readers call this when
--    they tap a sentence that has no pre-baked analysis. The admin
--    bell rings; admin clicks → lands on the article AI cache page and
--    re-bakes. Rate-limited 1-per-(content,10 min) so a single open
--    article doesn't carpet-bomb the inbox.
--
-- 3. cleanup_old_read_notifications RPC. Deletes the caller's own
--    notifications where read_at is older than 7 days. Frontends call
--    this once per session so confirmed alerts disappear instead of
--    piling up forever in the dropdown.

-- ── 1) Kind constraint: full set the UI renders ─────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    -- Already wired:
    'friend_request','friend_accepted','guestbook_post',
    'comment_reply','badge_earned',
    'streak_freeze_used','streak_freeze_awarded',
    'system',
    -- Rendered but previously rejected by the old constraint
    -- (fbModalSend caught the error silently and the bell never lit):
    'feedback_received',
    -- New: admin-only inbox for reader cache-miss taps
    'admin_cache_miss'
  ));

-- ── 2) Admin DELETE policy (own rows) ───────────────────────────
-- Lets the cleanup RPC delete via the user's own session without
-- needing service_role. Without this policy cleanup_old_read_
-- notifications would silently no-op.
DROP POLICY IF EXISTS notif_del_own ON public.notifications;
CREATE POLICY notif_del_own ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3) notify_admin_cache_miss ──────────────────────────────────
-- Called from the article reader when a sentence tap lands on an
-- article that has no per-sentence analysis cached. Inserts one
-- notification per admin user (identified by the admin email allow-
-- list in is_admin_email()'s definition), de-duplicated so the same
-- (content_type, content_id) within the last 10 minutes is a no-op.
--
-- p_sentence is truncated to 200 chars when stored so a clicker can
-- see *which* sentence prompted the alert without RLS-leaking long
-- bodies into the payload column.
CREATE OR REPLACE FUNCTION public.notify_admin_cache_miss(
  p_content_type text,
  p_content_id   text,
  p_sentence     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_admin_id   uuid;
  v_count      int  := 0;
  v_existing   int;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_content_id');
  END IF;

  -- Iterate every admin user. There's no admin_users table — the
  -- allow-list is hard-coded in is_admin_email(). Mirror that list
  -- here so the lookup stays in sync (single source of truth would
  -- be a proper admin_users table, but that's a bigger refactor).
  FOR v_admin_id IN
    SELECT id FROM auth.users
     WHERE email IN ('enane960819@gmail.com')
       AND id IS NOT NULL
  LOOP
    -- Dedupe: skip if there's already a notification for the same
    -- content within the last 10 minutes. Keeps the inbox usable
    -- when several readers hit the same un-cached article.
    SELECT count(*) INTO v_existing
      FROM public.notifications
     WHERE user_id = v_admin_id
       AND kind = 'admin_cache_miss'
       AND created_at > now() - interval '10 minutes'
       AND payload->>'content_id' = p_content_id
       AND payload->>'content_type' = p_content_type;

    IF v_existing = 0 THEN
      INSERT INTO public.notifications (user_id, kind, payload)
      VALUES (
        v_admin_id,
        'admin_cache_miss',
        jsonb_build_object(
          'content_type', coalesce(p_content_type, 'article'),
          'content_id',   p_content_id,
          'sentence',     left(coalesce(p_sentence, ''), 200),
          'from',         v_caller
        )
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'notified', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admin_cache_miss(text, text, text) TO authenticated;

-- ── 4) cleanup_old_read_notifications ───────────────────────────
-- Called from the frontend's bell-poll loop. Deletes the caller's
-- own notifications whose read_at is older than 7 days. The DELETE
-- policy above (notif_del_own) gates this to own rows even though
-- the function is SECURITY DEFINER, because the WHERE clause keys
-- on auth.uid().
CREATE OR REPLACE FUNCTION public.cleanup_old_read_notifications()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_user IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.notifications
   WHERE user_id = v_user
     AND read_at IS NOT NULL
     AND read_at < now() - interval '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_read_notifications() TO authenticated;

-- ── 5) Audit: confirm every rendered kind has a writer ──────────
-- The rendering side has branches for these kinds:
--   friend_request        → public.send_friend_request RPC (✓ wired)
--   friend_accepted       → public.accept_friend_request RPC (✓ wired)
--   guestbook_post        → public.post_guestbook RPC (✓ wired)
--   comment_reply         → public.notify_comment_reply RPC, called
--                            from comments.js after a reply insert (✓ wired)
--   streak_freeze_used    → consume_streak_freeze RPC (✓ wired)
--   streak_freeze_awarded → claim_streak_award RPC (✓ wired)
--   feedback_received     → admin fbModalSend via service_role.
--                            Was previously rejected by the old kind
--                            constraint — silent failure caught by a
--                            try/catch. **Fixed** by this migration
--                            adding the kind to the CHECK list.
--   admin_cache_miss      → notify_admin_cache_miss RPC (✓ NEW)
--   badge_earned          → DEAD. Render branch exists in shared.js
--                            but no INSERT path on the server (badges
--                            are tracked in localStorage only). Left in
--                            the kind enum for forward compatibility
--                            in case the badge system gets a backend.
--   room_visit            → DEAD. Render branch removed in the same
--                            client patch as this migration. No INSERT
--                            path ever existed and the kind isn't
--                            included in the constraint above.
