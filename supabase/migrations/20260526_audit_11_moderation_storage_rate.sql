-- ═════════════════════════════════════════════════════════════════════
-- Audit 11 (Content moderation) — Storage + Validation + Rate-limit
-- ═════════════════════════════════════════════════════════════════════
-- Bundles 6 of the 11th-audit fixes that share a DB surface:
--   MOD-F3  display-name validation trigger (reserved-name list)
--   MOD-F4  avatars bucket: MIME whitelist + 2 MB cap
--   MOD-F5  submit_comment RPC with server-side per-user cooldown
--   MOD-F8  reporter-images bucket: MIME whitelist + 5 MB cap
--   MOD-F13 notify_comment_reply skips when parent has blocked replier
--   MOD-F14 post_guestbook no longer leaks message preview into payload
--
-- OWNER MUST APPLY this migration via Supabase SQL editor or
-- `supabase db push`. Idempotent — safe to re-run.

-- ─── MOD-F4: avatars bucket constraints ─────────────────────────────
-- The avatars bucket was created via Supabase dashboard with no
-- server-side MIME or size enforcement. Without these settings the
-- client-side `accept` attribute is the only check — a user calling
-- the Storage API directly (Postman/curl) can upload .exe, .svg
-- (with embedded JS), .mp4, anything. And there's no size cap, so
-- one user could upload 500MB binaries and burn through the free
-- tier. Lock down to the same shape as `article-images`.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;

-- ─── MOD-F8: reporter-images bucket constraints ─────────────────────
-- Same issue: created without limits. Any authenticated user can
-- upload arbitrary binaries (mp4, exe, SVG with embedded JS) and
-- link to them via the bucket's `public: true` setting — turning
-- KoreHani's domain into a free file-hosting CDN for anything.
-- Add 5 MB cap + image-only MIME types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reporter-images',
  'reporter-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;

-- ─── MOD-F3: display-name validation trigger ────────────────────────
-- Previously the only check was a 30-char client-side trim. A user
-- could set display_name to "관리자", "KoreHani Staff", "Admin" and
-- impersonate the operator in comments. Or use control chars (RTL
-- override, zero-width) to invisibly inject hostile text. Server-
-- side trigger normalizes input, rejects reserved/admin-like names,
-- strips zero-width / RTL-override characters, length-caps.
--
-- Wordlist is intentionally minimal — owner can append. Profanity
-- filtering is NOT included here (Korean profanity lists are
-- sensitive content the owner should curate; for now the trigger
-- just blocks impersonation patterns).
CREATE OR REPLACE FUNCTION public._validate_display_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm text;
  v_lower text;
  v_reserved text[] := ARRAY[
    'admin', 'administrator', 'staff', 'mod', 'moderator', 'support',
    'korehan', 'korehani', 'korehan staff', 'korehani staff',
    'system', 'help', 'official', 'verified',
    '관리자', '운영자', '운영팀', '코레한', '코레하니', '시스템', '공식'
  ];
BEGIN
  IF p_name IS NULL THEN RETURN NULL; END IF;
  -- Strip zero-width + RTL-override / BOM characters.
  v_norm := regexp_replace(p_name, '[​-‏‪-‮﻿]', '', 'g');
  -- Collapse whitespace.
  v_norm := btrim(regexp_replace(v_norm, '\s+', ' ', 'g'));
  -- Length cap (server-side; client already does 30).
  IF char_length(v_norm) > 30 THEN
    v_norm := substring(v_norm from 1 for 30);
  END IF;
  IF char_length(v_norm) = 0 THEN
    RETURN NULL; -- caller decides — let user_stats default fire
  END IF;
  -- Reserved-name check (case-insensitive).
  v_lower := lower(v_norm);
  IF v_lower = ANY(v_reserved) THEN
    RAISE EXCEPTION 'display_name reserved: %', v_norm
      USING HINT = 'Choose a different name. "관리자" / "Admin" / similar are not allowed.';
  END IF;
  RETURN v_norm;
END;
$$;

CREATE OR REPLACE FUNCTION public._validate_display_name_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := public._validate_display_name(NEW.display_name);
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to user_stats (canonical display_name surface).
DROP TRIGGER IF EXISTS validate_display_name_on_user_stats ON public.user_stats;
CREATE TRIGGER validate_display_name_on_user_stats
  BEFORE INSERT OR UPDATE OF display_name ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION public._validate_display_name_trigger();

-- ─── MOD-F5: submit_comment RPC with server-side cooldown ───────────
-- The existing _commentLastTime in comments.js is in-memory JS —
-- bypassed by opening a second tab. RLS allowed direct insert with
-- no time gate. A logged-in user could script 1000 crypto-spam
-- comments per minute.
--
-- Strategy: SECURITY DEFINER RPC. Checks (1) last comment by this
-- user in the last 15 seconds. (2) display_name validation runs via
-- the trigger above if the row inserts into user_stats indirectly.
-- Falls back to the parent insert path; the frontend should be
-- migrated to call this RPC instead of direct INSERT.
CREATE OR REPLACE FUNCTION public.submit_comment(
  p_article_id text,
  p_content    text,
  p_parent_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_name text;
  v_avatar text;
  v_id uuid;
  COOLDOWN constant interval := interval '15 seconds';
  MIN_LEN constant int := 2;
  MAX_LEN constant int := 500;
  v_content text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  v_content := btrim(coalesce(p_content, ''));
  IF char_length(v_content) < MIN_LEN OR char_length(v_content) > MAX_LEN THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_length');
  END IF;
  IF p_article_id IS NULL OR char_length(btrim(p_article_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_article');
  END IF;

  -- Strip zero-width / RTL-override chars from comment content too
  -- (MOD-F10 backstop — frontend should also do this).
  v_content := regexp_replace(v_content, '[​-‏‪-‮﻿]', '', 'g');

  -- Per-user cooldown check. SECURITY DEFINER context = service role,
  -- so the read sees every comment including from other users (we
  -- only want this user's).
  SELECT max(created_at) INTO v_last
    FROM public.comments
   WHERE user_id = v_user;
  IF v_last IS NOT NULL AND (now() - v_last) < COOLDOWN THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'wait_seconds', GREATEST(1, EXTRACT(EPOCH FROM COOLDOWN - (now() - v_last))::int)
    );
  END IF;

  -- Pull display_name + avatar so the row carries them at insert
  -- time (matches the existing payload shape so other frontend code
  -- doesn't need to know about this RPC).
  SELECT display_name, avatar_url
    INTO v_name, v_avatar
    FROM public.user_stats
   WHERE user_id = v_user;

  INSERT INTO public.comments (article_id, user_id, user_name, avatar_url, content, parent_id)
    VALUES (p_article_id, v_user, COALESCE(v_name, 'User'), v_avatar, v_content, p_parent_id)
    RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_comment(text, text, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.submit_comment(text, text, uuid) TO authenticated;

-- ─── MOD-F13: block-aware comment-reply notification ────────────────
-- Previously notify_comment_reply skipped only the self-reply case.
-- A user who'd been blocked by the parent comment author could
-- still ping-bomb them by replying to their old comments. Add a
-- user_blocks join — if the parent author has blocked the replier
-- (or vice versa), skip the notification insert.
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
  v_blocked      boolean;
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
  IF v_parent_user = v_user THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'self_reply');
  END IF;

  -- MOD-F13: bidirectional block check. If either side has blocked
  -- the other, no notification.
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = v_parent_user AND blocked_id = v_user)
       OR (blocker_id = v_user AND blocked_id = v_parent_user)
  ) INTO v_blocked;
  IF v_blocked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'blocked');
  END IF;

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

-- ─── MOD-F14: post_guestbook no longer leaks message preview ────────
-- The trigger stored `left(v_msg, 80)` in notifications.payload. If
-- a future Edge Function ever emails / webhooks notification
-- payloads (e.g. when push notifications get wired), the abusive
-- preview would be re-sent to the host. Store only the guestbook_id;
-- the bell-dropdown UI can fetch the message live (so deletes
-- propagate too).
CREATE OR REPLACE FUNCTION public.post_guestbook(p_host uuid, p_message text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author uuid := auth.uid();
  v_msg text;
  v_id uuid;
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
  -- Strip zero-width / RTL-override chars (defensive).
  v_msg := regexp_replace(v_msg, '[​-‏‪-‮﻿]', '', 'g');
  INSERT INTO public.guestbook (host_id, author_id, message)
    VALUES (p_host, v_author, v_msg)
    RETURNING id INTO v_id;
  -- MOD-F14: store ONLY guestbook_id; UI fetches the message live
  -- via the existing public-read RLS on guestbook so deletes
  -- propagate. Removed the `preview` field.
  INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (p_host, 'guestbook_post', jsonb_build_object('from', v_author, 'guestbook_id', v_id));
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.post_guestbook(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.submit_comment(text, text, uuid) IS
  'MOD-F5: comment insert with server-side per-user cooldown. Replaces direct INSERT from frontend; the in-memory JS cooldown was bypassable via second tab.';
COMMENT ON FUNCTION public._validate_display_name(text) IS
  'MOD-F3: normalize + reject reserved (admin/system/coreahn impersonation) display names.';
