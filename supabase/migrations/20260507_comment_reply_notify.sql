-- Comment reply notification RPC
-- ================================================================
-- Reply-to-comment had no notification path despite the
-- 'comment_reply' kind being declared in the notifications enum
-- since 20260506_friends_notifications.sql. Replies inserted
-- silently and the parent author had no way to know.
--
-- This RPC takes a parent_comment_id, looks up the parent's author,
-- and (if it's not the caller themselves) inserts a notifications
-- row. SECURITY DEFINER so the caller can write to a row that
-- belongs to another user — same pattern as send_friend_request /
-- post_guestbook.

CREATE OR REPLACE FUNCTION public.notify_comment_reply(
  p_parent_id uuid,
  p_child_id  uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_parent_user  uuid;
  v_article_id   text;
  v_preview      text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  IF p_parent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_parent');
  END IF;

  SELECT user_id, article_id
    INTO v_parent_user, v_article_id
    FROM public.comments
   WHERE id = p_parent_id;
  IF v_parent_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'parent_not_found');
  END IF;
  -- Don't notify yourself for replying to your own comment.
  IF v_parent_user = v_user THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'self_reply');
  END IF;

  -- Pull a short preview of the child reply (if id given) so the bell
  -- dropdown can render "Alice replied: 'I disagree because…'".
  IF p_child_id IS NOT NULL THEN
    SELECT left(content, 80) INTO v_preview FROM public.comments WHERE id = p_child_id;
  END IF;

  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (v_parent_user, 'comment_reply', jsonb_build_object(
      'from',           v_user,
      'parent_id',      p_parent_id,
      'reply_id',       p_child_id,
      'article_id',     v_article_id,
      'preview',        v_preview
    ));

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_comment_reply(uuid, uuid) TO authenticated;
