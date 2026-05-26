-- ═════════════════════════════════════════════════════════════════════
-- Audit 11 — MOD-F6 (block-aware reads) + MOD-F9 (user_stats scrape)
-- ═════════════════════════════════════════════════════════════════════
-- Closes:
--   MOD-F6  Blocked users still visible in comment / profile / search reads
--   MOD-F9  Anonymous SELECT on user_stats enables PII scrape
--
-- Approach: tighten RLS SELECT policies on the two surfaces that
-- carry display_name + UGC content. The policies push the block
-- filter into the DB, so any frontend SELECT inherits it without
-- code change. Anon viewers (no auth) still see comments (needed
-- for SEO) but get NO rows from user_stats (anti-scrape).
--
-- Note: the audit found a production "user_stats public-readable"
-- SELECT policy that is NOT in the in-tree migration history (the
-- audit-6 hardening defines INSERT/UPDATE but not SELECT). That's
-- a drift. We defensively DROP every plausible name before
-- replacing.
--
-- OWNER MUST APPLY this migration. Idempotent — safe to re-run.

-- ─── MOD-F6: comments visible_to_caller ─────────────────────────────
-- Previous policy was "comments anon read" USING (true) — every
-- viewer saw every comment. A blocked author's words still showed
-- up on every article the viewer opened. Replace with a policy
-- that allows anon (for SEO + non-auth UX) but for authenticated
-- viewers excludes rows in a block relationship either direction.
DROP POLICY IF EXISTS "comments anon read" ON public.comments;
DROP POLICY IF EXISTS "comments visible_to_caller" ON public.comments;
CREATE POLICY "comments visible_to_caller"
ON public.comments
FOR SELECT TO authenticated, anon
USING (
  CASE
    WHEN auth.uid() IS NULL THEN TRUE  -- anon sees everything (SEO)
    ELSE NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = comments.user_id)
         OR (blocker_id = comments.user_id AND blocked_id = auth.uid())
    )
  END
);

-- ─── MOD-F9: user_stats authenticated-only + block filter ───────────
-- Previous (drift) policy was anon-readable, enabling a single
-- suspended account that knew the admin's user_id to scrape every
-- user's display_name + xp + streak via paged reads. Tighten:
-- only authenticated viewers, only own row OR rows for users not
-- in a mutual block relationship.
DROP POLICY IF EXISTS "user_stats anon read" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats public read" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats authenticated read" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats visible_to_caller" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats select" ON public.user_stats;
CREATE POLICY "user_stats visible_to_caller"
ON public.user_stats
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR NOT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = user_stats.user_id)
       OR (blocker_id = user_stats.user_id AND blocked_id = auth.uid())
  )
);

-- No anon SELECT policy → anon gets 0 rows on user_stats.
-- Anonymous visitors viewing /korehan-profile.html?id=X now see
-- a "profile not available" state. Authenticated visitors see the
-- profile UNLESS either side is blocked.

COMMENT ON POLICY "comments visible_to_caller" ON public.comments IS
  'MOD-F6: hide comments from users the viewer has blocked, AND from users who have blocked the viewer. Anon sees everything (SEO).';
COMMENT ON POLICY "user_stats visible_to_caller" ON public.user_stats IS
  'MOD-F9 + F6: revoke anon SELECT (anti-scrape). Authenticated viewers see own row + non-blocked rows.';
