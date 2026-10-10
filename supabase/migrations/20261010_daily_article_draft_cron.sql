-- ═════════════════════════════════════════════════════════════════════
-- pg_cron: daily-article-draft — 4 auto drafts every morning
-- ═════════════════════════════════════════════════════════════════════
-- Calls supabase/functions/daily-article-draft every 5 minutes between
-- 06:00 and 06:55 KST (21:00–21:55 UTC). Tick 1 fetches headlines and
-- queues 4 picks (one per level); each later tick builds ONE draft
-- (body + sentence analysis + quiz). Once the queue is done, ticks are
-- cheap no-ops. Drafts land as status='draft' — admin publishes from
-- the CMS Article List ("🤖 Today's auto-drafts" banner).
--
-- OWNER MUST:
--   1. Deploy the function:  supabase functions deploy daily-article-draft
--   2. Run this file in the Supabase SQL editor.
--
-- Auth reuses the CRON_SECRET that the existing `daily-content-gen` job
-- uses. This file assumes it's stored in Vault as 'cron_secret'. If your
-- daily-content-gen job reads it differently, copy that job's header
-- expression instead:
--   select command from cron.job where jobname = 'daily-content-gen';

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop a previous registration first.
select cron.unschedule(jobid) from cron.job where jobname = 'daily-article-draft';

select cron.schedule(
  'daily-article-draft',
  '*/5 21 * * *',  -- 21:00–21:55 UTC = 06:00–06:55 KST
  $$
  select net.http_post(
    url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-article-draft',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Check:
--   select jobid, jobname, schedule from cron.job where jobname = 'daily-article-draft';
--   select * from net._http_response order by created desc limit 5;  -- recent call results
