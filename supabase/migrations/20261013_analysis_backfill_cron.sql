-- auto-apply
-- F3: overnight sentence-analysis backfill. Every 20 min from 00:00 to 05:40
-- KST (15:00–20:40 UTC), call daily-article-draft with {"backfill":true};
-- each call bakes up to 3 published articles that still lack per-sentence
-- analysis (cap 60/day, ~1¢ each with Haiku). Same auth as the draft cron.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'analysis-backfill';

select cron.schedule(
  'analysis-backfill',
  '*/20 15-20 * * *',
  $$
  select net.http_post(
    url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-article-draft',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body    := '{"backfill":true}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
