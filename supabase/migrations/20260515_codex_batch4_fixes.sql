-- Codex batch 4 — two SQL fixes:

-- 1) app_settings allowlist missed non-secret UI config keys.
-- The previous hotfix migration locked down app_settings to only the
-- keys I knew about at the time. Codex flagged that public pages
-- (index.html, korehan-reporter.html) read other non-secret keys
-- that are now silently denied:
--   - quick_win_tips    (home page tip list, index.html:1476)
--   - reporter_bg_image_url (reporter page hero bg, line 524)
-- Both are pure UI config, not secrets. Add to allowlist.

DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;

CREATE POLICY "app_settings public read"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (
    key IN (
      'phrases',
      'phrase_rotation_offset',
      'site_config',
      'sections',
      'shop_items_fallback',
      'shop_items_v1',
      'admin_emails',
      'quick_win_tips',          -- home page tip strip
      'reporter_bg_image_url'    -- reporter page hero bg
    )
    OR key LIKE 'room_data_%'
    OR key LIKE 'shop_items_%'
  );


-- 2) conversations_data UPDATE policy was created unconditionally,
-- but the column-level REVOKE + GRANT only runs inside the IF
-- ctx_en EXISTS block. On databases where ctx_en is absent (Codex's
-- exact case), the FOR UPDATE TO public USING (true) policy stays
-- in place WITHOUT the column gate, which means any anon/auth user
-- can update arbitrary columns. Privilege escalation / content
-- tampering.
--
-- Fix: gate the policy creation on the same IF column check. If
-- ctx_en doesn't exist, the policy isn't created.

-- First DROP any policy we may have created in the previous migration
-- (defense in depth — if the column was absent there's still a stale
-- permissive policy to clean up).
DROP POLICY IF EXISTS "conversations_data public update ctx_en" ON public.conversations_data;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations_data' AND column_name='ctx_en'
  ) THEN
    EXECUTE 'CREATE POLICY "conversations_data public update ctx_en"
              ON public.conversations_data FOR UPDATE TO public
              USING (true) WITH CHECK (true)';
    EXECUTE 'REVOKE UPDATE ON public.conversations_data FROM anon, authenticated';
    EXECUTE 'GRANT UPDATE (ctx_en) ON public.conversations_data TO anon, authenticated';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
