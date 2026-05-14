-- Onboarding completion is read from user_stats.onboarded / onboarded_at
-- by korehan-shared.js (checkOnboardingStatus) and korehan-onboarding.html.
-- The columns were never added in a migration, so production was returning
-- 400 Bad Request on every page load:
--   GET .../user_stats?select=onboarded,onboarded_at,created_at
--   → column user_stats.onboarded does not exist
--
-- This adds the columns idempotently and backfills `onboarded = true` for
-- any user who already has a `kh_onboarded_*` flag in localStorage — we
-- can't read localStorage from SQL, so we just assume any user with read
-- history older than a day finished onboarding (otherwise they wouldn't
-- have read anything). New signups will set the flag explicitly via the
-- onboarding page.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Backfill: any existing user with a non-trivial reading history is
-- almost certainly past the onboarding flow.
UPDATE public.user_stats us
   SET onboarded    = true,
       onboarded_at = COALESCE(us.onboarded_at, now())
 WHERE us.onboarded = false
   AND EXISTS (
     SELECT 1 FROM public.user_read_history urh
      WHERE urh.user_id = us.user_id
   );

-- Reload PostgREST schema cache so the new columns are visible to the
-- REST endpoint without restarting the API.
NOTIFY pgrst, 'reload schema';
