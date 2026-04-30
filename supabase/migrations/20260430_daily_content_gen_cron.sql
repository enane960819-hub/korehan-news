-- Daily Content Generation Cron
--
-- Schedules the `daily-content-gen` Edge Function to run once a day so
-- study_daily_content is populated for all four levels (Starter, Beginner,
-- Intermediate, Advanced) before learners hit the Study Room. Without this
-- the Tree / Forest tabs fall through to the slow client-side generation
-- path every time a user clicks them.
--
-- Runs at 02:00 KST (17:00 UTC the previous day). The Edge Function itself
-- generates today's KST date plus tomorrow's KST date, and upserts on
-- (scheduled_date, level), so re-running is safe and fills any gaps.

-- ── 1. Extensions (no-ops if already enabled) ─────────────────────
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── 2. Cron secret in vault ───────────────────────────────────────
-- The Edge Function accepts a Bearer token equal to the CRON_SECRET env
-- var (see daily-content-gen/index.ts auth block). Store the same value
-- here so pg_cron can read it from vault.decrypted_secrets at run time.
--
-- IMPORTANT: replace 'REPLACE_WITH_RANDOM_STRING' with a real secret and
-- ALSO set the same value in:
--   Dashboard → Edge Functions → daily-content-gen → Secrets → CRON_SECRET
do $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = 'cron_secret';
  if existing_id is null then
    perform vault.create_secret(
      'REPLACE_WITH_RANDOM_STRING',
      'cron_secret',
      'Bearer token used by pg_cron to invoke daily-content-gen'
    );
  end if;
end $$;

-- ── 3. Schedule ────────────────────────────────────────────────────
-- Unschedule any previous version of this job so re-running the migration
-- doesn't pile up duplicate cron entries.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-content-gen') then
    perform cron.unschedule('daily-content-gen');
  end if;
end $$;

select cron.schedule(
  'daily-content-gen',
  '0 17 * * *',  -- 17:00 UTC daily = 02:00 KST next day
  $cron$
  select net.http_post(
    url := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-content-gen',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

-- ── 4. Sanity check ────────────────────────────────────────────────
-- Run this manually after applying the migration to confirm the row is
-- there and the schedule looks right:
--
--   select jobname, schedule, active from cron.job where jobname = 'daily-content-gen';
--
-- And to fire it once on demand without waiting for 02:00 KST:
--
--   select net.http_post(
--     url := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-content-gen',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer YOUR_CRON_SECRET'),
--     body := '{}'::jsonb
--   );
