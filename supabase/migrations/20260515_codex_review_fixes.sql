-- Codex review fixes — two SQL items.

-- 1) stories_data: allow anon/auth to UPDATE title_en (only this
--    one column). The frontend backfills English titles from
--    Claude on first visit (index.html:1701) and persists them to
--    stories_data.title_en so the next visitor reuses the
--    translation. Without an UPDATE policy, RLS silently denies
--    the write — translations never persist and every visitor
--    re-pays the Haiku call.
--
--    Two-stage policy: anyone can UPDATE rows where they're only
--    touching title_en. We can't enforce "only this column" purely
--    in RLS (USING is row-level), so we use a trigger to reject
--    UPDATEs that touch anything else. Simpler: use a column-grant.
--    Actually simpler still: trust the frontend to only set
--    title_en (we audit the code) and gate the policy on
--    `title_en IS NOT NULL` for the new row state. If a malicious
--    client did a wider update we'd see content vandalism — but
--    the only writable column at risk is title_en itself, since
--    the policy only fires on UPDATE.
--
--    For safety, use column privileges: revoke UPDATE on all
--    columns then grant only title_en.

ALTER TABLE public.stories_data ENABLE ROW LEVEL SECURITY;

-- Drop any prior update policy with these names
DROP POLICY IF EXISTS "stories_data public update title_en" ON public.stories_data;

CREATE POLICY "stories_data public update title_en"
  ON public.stories_data
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Column-level grant: anon/auth can only write title_en, never
-- mutate body / data / level etc. Admin writes through service-
-- role (bypasses both column grants AND RLS).
REVOKE UPDATE ON public.stories_data FROM anon, authenticated;
GRANT UPDATE (title_en) ON public.stories_data TO anon, authenticated;

-- Same pattern for conversations_data (ctx_en backfill if/when added)
ALTER TABLE public.conversations_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_data public update ctx_en" ON public.conversations_data;
CREATE POLICY "conversations_data public update ctx_en"
  ON public.conversations_data
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations_data' AND column_name='ctx_en'
  ) THEN
    EXECUTE 'REVOKE UPDATE ON public.conversations_data FROM anon, authenticated';
    EXECUTE 'GRANT UPDATE (ctx_en) ON public.conversations_data TO anon, authenticated';
  END IF;
END
$$;


-- 2) client_errors: tighten the public INSERT policy so external
--    scripts using the anon key can't flood the table. Add WITH
--    CHECK constraints on payload size + force user_id to either
--    NULL (anon) or auth.uid() (authenticated). Codex flag: P2.
--
--    Logical rate limiting still lives in the frontend
--    (_KH_ERR_LOG_CAP=25 per session, message dedupe). This is
--    defense-in-depth at the DB layer.

DROP POLICY IF EXISTS "client_errors anyone insert" ON public.client_errors;
CREATE POLICY "client_errors anyone insert"
  ON public.client_errors
  FOR INSERT
  TO public
  WITH CHECK (
    -- Anon visitors can insert with user_id NULL; authenticated
    -- must use their own id (no impersonation).
    (user_id IS NULL OR user_id = auth.uid())
    -- Hard payload caps so an attacker can't write 1MB rows.
    AND length(coalesce(message, '')) BETWEEN 1 AND 2000
    AND length(coalesce(stack, '')) <= 8000
    AND length(coalesce(url, '')) <= 500
    AND length(coalesce(user_agent, '')) <= 500
  );

NOTIFY pgrst, 'reload schema';
