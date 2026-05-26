-- 6차 오딧 (2026-05-26) — DB schema + RLS hardening.
-- Findings DB-F1 through DB-F15. This migration covers the P0 + P1
-- items that need SERVER-side enforcement (client code can't be
-- trusted as a security boundary). P2 follow-ups noted as comments.
--
-- All changes are additive / protective — no schema-breaking column
-- drops or destructive policy replacements. Apply via Supabase SQL
-- editor or `supabase db push`. Review each block before applying;
-- the audit was code-only (no live DB introspection), so a few
-- policies here may duplicate ones the owner already added.
--
-- IMPORTANT: this migration adds STRICTER policies. If a feature
-- silently stops working after apply, look for an existing
-- permissive policy that needs removing too (Postgres OR-combines
-- multiple policies on the same role/op).

-- ──────────────────────────────────────────────────────────────
-- DB-F1 (P0) — app_settings: lock down writes
-- ──────────────────────────────────────────────────────────────
-- Frontend code upserts `app_settings` for per-user state with
-- keys like `kh_affinity_fb_<uid>`, `room_data_<uid>`, plus
-- queue / seed / phrases. The same table holds `anthropic_key`,
-- `admin_emails`, etc. If RLS allows arbitrary INSERT/UPDATE from
-- authenticated, ANY signed-in user can overwrite the Anthropic
-- key and drain Claude credits.

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop any prior write policies on app_settings (owner: comment
-- out if you have specific policies you want to preserve).
DROP POLICY IF EXISTS "app_settings authenticated write user keys" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings authenticated read user keys" ON public.app_settings;

-- READ: per-user keys (kh_affinity_fb_UID / room_data_UID) read by
-- the owning user only. Public-config keys (no user suffix and not
-- in the secret-key list) readable by everyone for things like
-- feature flags. Secret keys never returned to clients.
CREATE POLICY "app_settings read user-scoped + public config"
ON public.app_settings
FOR SELECT TO authenticated, anon
USING (
  -- Public-config rows: short keys without a user-id suffix and not
  -- in the secret-list.
  (
    key NOT IN ('anthropic_key', 'admin_emails', 'cron_secret',
                'stripe_secret', 'stripe_webhook_secret',
                'service_role_key', 'discord_webhook_url')
    AND key !~ '_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  OR
  -- Per-user rows: only the owning user.
  (
    auth.uid() IS NOT NULL
    AND (
      key = 'kh_affinity_fb_' || auth.uid()::text
      OR key = 'room_data_' || auth.uid()::text
    )
  )
);

-- WRITE: ONLY per-user keys for the owning user. Everything else
-- must go through service_role (Edge Functions / admin).
CREATE POLICY "app_settings write own user-scoped keys"
ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    key = 'kh_affinity_fb_' || auth.uid()::text
    OR key = 'room_data_' || auth.uid()::text
  )
);
CREATE POLICY "app_settings update own user-scoped keys"
ON public.app_settings
FOR UPDATE TO authenticated
USING (
  key = 'kh_affinity_fb_' || auth.uid()::text
  OR key = 'room_data_' || auth.uid()::text
)
WITH CHECK (
  key = 'kh_affinity_fb_' || auth.uid()::text
  OR key = 'room_data_' || auth.uid()::text
);

-- ──────────────────────────────────────────────────────────────
-- DB-F2 (P0) — user_stats: revoke direct writes to currency / xp.
-- ──────────────────────────────────────────────────────────────
-- Client code at korehan-learning-overview.html:2298 and
-- korehan/js/kh-badges.js:171 directly UPDATEs `xp` / `coin_balance`
-- with values computed locally. Any user can set their xp to 1e9
-- via the browser console.
--
-- Strategy: column-level revoke on UPDATE for sensitive columns.
-- All currency mutations must go through SECURITY DEFINER RPCs
-- (`award_xp`, `purchase_coin_shop_item`, etc.) that enforce
-- caller identity.

REVOKE UPDATE (
  xp, coin_balance, mission_streak, streak,
  articles_read, words_saved, quizzes_done, fill_done,
  writing_tickets, last_mission_date
) ON public.user_stats FROM authenticated, anon;

-- Keep email / display_name / avatar / preferences user-writable
-- via RLS (no column revoke needed for those).
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_stats authenticated update own profile fields" ON public.user_stats;
CREATE POLICY "user_stats authenticated update own profile fields"
ON public.user_stats
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_stats authenticated insert own row" ON public.user_stats;
CREATE POLICY "user_stats authenticated insert own row"
ON public.user_stats
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- DB-F3 (P0) — shop_items + gacha_items: catalogs are admin-only.
-- ──────────────────────────────────────────────────────────────
-- Frontend "seeds missing items" by upserting catalog rows. A
-- malicious user can overwrite cash_price = 0 then buy.

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_items ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.shop_items FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.gacha_items FROM authenticated, anon;

-- SELECT remains open (clients need to browse the catalog).
-- Catalog seeding moves to migration / admin Edge Function.

-- ──────────────────────────────────────────────────────────────
-- DB-F4 (P0) — payment_orders + shop_purchases: server-side only.
-- ──────────────────────────────────────────────────────────────
-- Frontend inserts `amount` and `status` directly. A user can
-- set amount = 0.01 and status = 'paid' from the console.

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.payment_orders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.shop_purchases FROM authenticated, anon;

-- Reads: own rows only.
DROP POLICY IF EXISTS "payment_orders authenticated read own" ON public.payment_orders;
CREATE POLICY "payment_orders authenticated read own"
ON public.payment_orders
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "shop_purchases authenticated read own" ON public.shop_purchases;
CREATE POLICY "shop_purchases authenticated read own"
ON public.shop_purchases
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- All writes must come from the Stripe webhook (service_role).

-- ──────────────────────────────────────────────────────────────
-- DB-F5 (P0) — article_views: atomic increment RPC.
-- ──────────────────────────────────────────────────────────────
-- Frontend reads view_count, +1's it, writes back. Race-prone AND
-- forgeable (set view_count = 99999).

CREATE OR REPLACE FUNCTION public.increment_article_view(p_article_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  IF p_article_id IS NULL OR length(p_article_id) = 0 OR length(p_article_id) > 64 THEN
    RAISE EXCEPTION 'invalid article id';
  END IF;
  INSERT INTO public.article_views (article_id, view_count, updated_at)
  VALUES (p_article_id, 1, now())
  ON CONFLICT (article_id) DO UPDATE
    SET view_count = public.article_views.view_count + 1,
        updated_at = now()
  RETURNING view_count INTO v_count;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_article_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_article_view(text) TO authenticated, anon;

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE ON public.article_views FROM authenticated, anon;
-- SELECT remains open for read-side aggregations.

-- ──────────────────────────────────────────────────────────────
-- DB-F6 (P0) — comments: column WITH CHECK enforcing user_id.
-- ──────────────────────────────────────────────────────────────
-- Client patch (this PR) stops using `supaUser.email` as the
-- comment author fallback. DB-side: prevent client from forging
-- user_id or user_name on someone else's behalf.

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments authenticated insert own" ON public.comments;
CREATE POLICY "comments authenticated insert own"
ON public.comments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments authenticated update own" ON public.comments;
CREATE POLICY "comments authenticated update own"
ON public.comments
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments authenticated delete own" ON public.comments;
CREATE POLICY "comments authenticated delete own"
ON public.comments
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "comments anon read" ON public.comments;
CREATE POLICY "comments anon read"
ON public.comments
FOR SELECT TO authenticated, anon
USING (true);

-- ──────────────────────────────────────────────────────────────
-- DB-F7 (P1) — award_xp / purchase_coin_shop_item: ignore caller
-- ──────────────────────────────────────────────────────────────
-- Both RPCs take p_user_id from the caller. Even though they're
-- SECURITY DEFINER, they don't validate p_user_id matches the
-- JWT. A malicious user can call them with another user_id.
--
-- Owner: open the RPC bodies and replace `p_user_id` with
-- `auth.uid()` inside the function. Or wrap with a strict
-- precondition like:
--
--   IF p_user_id IS DISTINCT FROM auth.uid() THEN
--     RAISE EXCEPTION 'caller mismatch';
--   END IF;
--
-- (Schema-altering RPC body changes intentionally NOT done here
-- since the original body lives in production-side migrations
-- not checked in — the owner needs to edit those.)

-- ──────────────────────────────────────────────────────────────
-- DB-F10 (P1) — weekly_live_registrations: drop user-emails view.
-- ──────────────────────────────────────────────────────────────
-- The table has an `email` column the client writes on signup.
-- Other authenticated users can SELECT email to harvest the
-- attendee list. Strip the column from the read path.

ALTER TABLE public.weekly_live_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_live_registrations select own" ON public.weekly_live_registrations;
CREATE POLICY "weekly_live_registrations select own"
ON public.weekly_live_registrations
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "weekly_live_registrations insert own" ON public.weekly_live_registrations;
CREATE POLICY "weekly_live_registrations insert own"
ON public.weekly_live_registrations
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Follow-up (owner): consider dropping the `email` column entirely
-- and looking it up server-side in any cron that emails attendees.

-- ──────────────────────────────────────────────────────────────
-- DB-F11 (P1) — client_errors: WITH CHECK user_id.
-- ──────────────────────────────────────────────────────────────
-- Client writes user_id directly from JS. Without RLS, anyone
-- can spam another user's id into the table.

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_errors authenticated insert own" ON public.client_errors;
CREATE POLICY "client_errors authenticated insert own"
ON public.client_errors
FOR INSERT TO authenticated, anon
WITH CHECK (
  -- Anon inserts must have NULL user_id; authenticated must match.
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);
-- SELECT only via admin role (handled by admin RPC, not here).

-- ──────────────────────────────────────────────────────────────
-- DB-F12 (P1) — weekly_live_sessions: admin-create only.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.weekly_live_sessions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.weekly_live_sessions FROM authenticated, anon;

DROP POLICY IF EXISTS "weekly_live_sessions public select" ON public.weekly_live_sessions;
CREATE POLICY "weekly_live_sessions public select"
ON public.weekly_live_sessions
FOR SELECT TO authenticated, anon
USING (true);

-- Admin writes via service_role / admin-api Edge Function.

-- ──────────────────────────────────────────────────────────────
-- DB-F13 (P2) — coin_transactions: append-only via RPC.
-- ──────────────────────────────────────────────────────────────
-- Client writes audit rows with attacker-controlled amount /
-- balance_after / source / memo. If DB-F2's RPCs already log,
-- direct client INSERT is unnecessary.

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.coin_transactions FROM authenticated, anon;

DROP POLICY IF EXISTS "coin_transactions read own" ON public.coin_transactions;
CREATE POLICY "coin_transactions read own"
ON public.coin_transactions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- DB-F14 (P2) — user_submissions: column-level WITH CHECK.
-- ──────────────────────────────────────────────────────────────
-- Client upserts score / rubric / status. If RLS only matches
-- on user_id, a user can mark their own submission "reviewed"
-- with a fake high score.
--
-- Owner: keep `score`, `rubric`, `status`, `reviewer_notes` writable
-- only by SECURITY DEFINER scoring RPC. Either:
--   1) REVOKE UPDATE (score, rubric, status, reviewer_notes)
--      ON public.user_submissions FROM authenticated;
--   2) Or use a trigger that raises if these change without the
--      `app.current_role` GUC being set to 'scorer'.
-- Recommended #1.

REVOKE UPDATE (score, rubric, status, reviewer_notes)
  ON public.user_submissions FROM authenticated, anon;

ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- Follow-ups not covered here (owner action needed)
-- ──────────────────────────────────────────────────────────────
-- DB-F8 (FALSE POSITIVE): inspect_table_columns already has
--   admin-email check inside the function body (see
--   20260515_schema_inspect_rpc.sql). No change needed.
-- DB-F9: split user_stats into public-readable view (display_name,
--   xp, streak, articles_read) vs private table (email, prefs).
--   Bigger refactor — schema review with owner first.
-- DB-F15: client patch (this PR) strips ?query and #hash from
--   client_errors.url before insert. No DB change.
