-- auto-apply
-- Register the daily-article-draft cron so new articles actually get drafted.
-- The original 20261010 migration was NOT auto-apply (owner-manual) and the job
-- was never registered — no new drafts since 2026-10-10. This mirrors the
-- working analysis-backfill cron (20261013) exactly: same function, same
-- cron_secret auth, pg_cron/pg_net. Idempotent (unschedule then schedule).
-- Schedule: every 5 min 21:00-21:55 UTC = 06:00-06:55 KST. Tick 1 queues 4
-- picks (one per level); later ticks each build one draft; then no-op.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'daily-article-draft';

select cron.schedule(
  'daily-article-draft',
  '*/5 21 * * *',
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
