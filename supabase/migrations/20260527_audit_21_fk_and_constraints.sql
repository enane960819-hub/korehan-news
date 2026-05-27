-- ═════════════════════════════════════════════════════════════════════
-- Audit 21 — FK gaps + constraint hardening + soft-delete RLS
-- ═════════════════════════════════════════════════════════════════════
-- Closes DR-21-F1, F2, F3, F11, F13 from audit 21.
--
-- Background: multiple user-owned tables were created with a bare
-- `user_id uuid not null` column instead of `references auth.users(id)
-- on delete cascade`. The `delete-account` Edge Function deletes the
-- auth.users row, but child rows in these tables linger as orphans:
--   - coin_transactions, shop_purchases, owned_items, payment_orders
--   - reporter_gift_history, reporter_user_affinity
--
-- This migration adds the missing FKs with NOT VALID, so the constraint
-- applies to NEW rows immediately without rejecting any existing orphan
-- rows. The owner can then audit existing orphans, decide whether to
-- delete them, and run VALIDATE CONSTRAINT to enforce on legacy data.
--
-- Also: drops + re-adds the newsletter_campaigns.created_by FK with
-- ON DELETE SET NULL (was implicit NO ACTION → blocks admin deletion).
-- Also: adds ON DELETE SET NULL FK to user_submissions.admin_user_id
-- (was a bare uuid; admin deletion left orphan reviewer attribution).
-- Also: tightens the comments "visible_to_caller" RLS policy to filter
-- soft-deleted rows (a direct SELECT * could otherwise leak them past
-- the soft-delete UX).
--
-- OWNER MUST APPLY this migration. Idempotent. Safe to re-run.
-- After applying, audit orphan rows with the helper view defined at
-- the bottom and decide whether to clean up + VALIDATE CONSTRAINT.

-- ─── F1: coin/shop tables — user_id FK to auth.users ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_coin_transactions_user'
      AND conrelid = 'public.coin_transactions'::regclass
  ) THEN
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT fk_coin_transactions_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_shop_purchases_user'
      AND conrelid = 'public.shop_purchases'::regclass
  ) THEN
    ALTER TABLE public.shop_purchases
      ADD CONSTRAINT fk_shop_purchases_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_owned_items_user'
      AND conrelid = 'public.owned_items'::regclass
  ) THEN
    ALTER TABLE public.owned_items
      ADD CONSTRAINT fk_owned_items_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- payment_orders may not exist on every deployment (Speaking Coach v3
-- was never applied). Guard the ALTER behind a table-existence check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'payment_orders' AND relnamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_payment_orders_user'
      AND conrelid = 'public.payment_orders'::regclass
  ) THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT fk_payment_orders_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- ─── F2: reporter tables — user_id FK to auth.users ──────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_reporter_gift_history_user'
      AND conrelid = 'public.reporter_gift_history'::regclass
  ) THEN
    ALTER TABLE public.reporter_gift_history
      ADD CONSTRAINT fk_reporter_gift_history_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_reporter_user_affinity_user'
      AND conrelid = 'public.reporter_user_affinity'::regclass
  ) THEN
    ALTER TABLE public.reporter_user_affinity
      ADD CONSTRAINT fk_reporter_user_affinity_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- ─── F3: user_submissions.admin_user_id ON DELETE SET NULL ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_user_submissions_admin'
      AND conrelid = 'public.user_submissions'::regclass
  ) THEN
    ALTER TABLE public.user_submissions
      ADD CONSTRAINT fk_user_submissions_admin
      FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- ─── F11: newsletter_campaigns.created_by — DROP + ADD ON DELETE SET NULL ─
-- The original FK was created without an ON DELETE clause (default = NO
-- ACTION), which would block the admin account deletion entirely. Replace
-- with SET NULL so deletion succeeds + the campaign keeps a NULL creator
-- as an audit trail.

DO $$
DECLARE
  v_existing_fk text;
BEGIN
  SELECT conname INTO v_existing_fk
  FROM pg_constraint
  WHERE conrelid = 'public.newsletter_campaigns'::regclass
    AND contype = 'f'
    AND conname LIKE '%created_by%';
  IF v_existing_fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.newsletter_campaigns DROP CONSTRAINT %I', v_existing_fk);
  END IF;
  ALTER TABLE public.newsletter_campaigns
    ADD CONSTRAINT fk_newsletter_campaigns_created_by
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END $$;

-- ─── F13: comments RLS — hide soft-deleted rows ─────────────────────
-- The current "comments visible_to_caller" policy filters by user_blocks
-- but does NOT filter by deleted_at, so a direct SELECT * could leak
-- comments that the soft_delete_comment RPC marked as removed. Tighten
-- by adding deleted_at IS NULL to both branches of the CASE.

DROP POLICY IF EXISTS "comments visible_to_caller" ON public.comments;
CREATE POLICY "comments visible_to_caller"
ON public.comments
FOR SELECT TO authenticated, anon
USING (
  deleted_at IS NULL
  AND CASE
    WHEN auth.uid() IS NULL THEN TRUE  -- anon sees non-deleted (SEO)
    ELSE NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = comments.user_id)
         OR (blocker_id = comments.user_id AND blocked_id = auth.uid())
    )
  END
);

-- ─── Orphan audit helper view ───────────────────────────────────────
-- Run before VALIDATE CONSTRAINT on the NOT VALID FKs above. If any of
-- these return rows, the owner must decide whether to delete them (and
-- absorb the data loss) or leave the NOT VALID constraint in place.

CREATE OR REPLACE VIEW public.kh_orphan_user_rows AS
SELECT 'coin_transactions' AS table_name, COUNT(*) AS orphan_count
FROM public.coin_transactions c
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'shop_purchases', COUNT(*)
FROM public.shop_purchases c
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'owned_items', COUNT(*)
FROM public.owned_items c
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'reporter_gift_history', COUNT(*)
FROM public.reporter_gift_history c
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)
UNION ALL
SELECT 'reporter_user_affinity', COUNT(*)
FROM public.reporter_user_affinity c
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id);

GRANT SELECT ON public.kh_orphan_user_rows TO authenticated;
REVOKE SELECT ON public.kh_orphan_user_rows FROM anon;

COMMENT ON VIEW public.kh_orphan_user_rows IS
  'Audit 21: run SELECT * FROM kh_orphan_user_rows; before running VALIDATE CONSTRAINT on any of the NOT VALID FKs added by this migration. Non-zero counts mean orphan rows that the constraint would reject — clean them up first or leave the FK NOT VALID for legacy data only.';
