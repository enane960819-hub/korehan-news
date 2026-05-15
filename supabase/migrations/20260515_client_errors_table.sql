-- client_errors: surface silent failures the owner can't see in
-- mobile Safari devtools. Every try{}catch(_){} that swallows an
-- error gets a kh_log_error(message, ctx) call alongside, and those
-- rows show up in the admin dashboard. Owner-reported pattern of
-- "saved but gone" / "loading forever" all boil down to caught
-- errors that nobody ever sees.
--
-- RLS: any authenticated user can INSERT (so we capture errors from
-- real sessions). Only admins SELECT. Anonymous users can INSERT
-- with user_id = NULL — we capture them too because the home-page
-- empty-state bug only happens for unauthenticated visitors.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message     text NOT NULL,
  stack       text,
  url         text,
  user_agent  text,
  context     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_errors_created_at_idx
  ON public.client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_message_idx
  ON public.client_errors (message);
CREATE INDEX IF NOT EXISTS client_errors_user_id_idx
  ON public.client_errors (user_id);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- INSERT: anyone (auth or anon). We rate-limit at the application
-- layer instead of via RLS because RLS rate-limiting is awkward.
DROP POLICY IF EXISTS "client_errors anyone insert" ON public.client_errors;
CREATE POLICY "client_errors anyone insert"
  ON public.client_errors
  FOR INSERT
  TO public
  WITH CHECK (true);

-- SELECT: admin only. Reuse app_settings.admin_emails for parity
-- with the rest of the admin RPCs.
DROP POLICY IF EXISTS "client_errors admin select" ON public.client_errors;
CREATE POLICY "client_errors admin select"
  ON public.client_errors
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT jsonb_array_elements_text(coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'admin_emails'),
        '["enane960819@gmail.com"]'::jsonb
      ))
    )
  );

-- DELETE: admin only (for purging noise).
DROP POLICY IF EXISTS "client_errors admin delete" ON public.client_errors;
CREATE POLICY "client_errors admin delete"
  ON public.client_errors
  FOR DELETE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT jsonb_array_elements_text(coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'admin_emails'),
        '["enane960819@gmail.com"]'::jsonb
      ))
    )
  );

NOTIFY pgrst, 'reload schema';
