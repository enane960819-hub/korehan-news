-- Adds the `onboarded` + `onboarded_at` columns to user_stats so the
-- frontend's cross-device onboarding check (korehan-shared.js
-- checkOnboardingStatus, korehan-onboarding.html initUser) can read
-- a real signal instead of relying solely on per-device localStorage.
--
-- Symptom this fixes (console, signed-in pages):
--   GET /rest/v1/user_stats?select=onboarded&user_id=eq.<uuid>
--   → 400 Bad Request
--   { "code":"42703", "message":"column user_stats.onboarded does not exist" }
--
-- Idempotent — safe to re-run on production. The frontend latches
-- a window-level flag when it sees 42703, so until this runs the
-- behaviour is "rely on kh_onboarded_<userId> localStorage", which
-- is functional but per-device.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS onboarded    boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Backfill: any user with completed onboarding (their kh_onboarded_*
-- localStorage flag) signals through the next page load when the
-- frontend's finishOnboarding sets onboarded=true on this row. No
-- server-side backfill possible since the signal lives client-side.

-- Verification (run after applying):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='user_stats'
--     AND column_name IN ('onboarded','onboarded_at');
