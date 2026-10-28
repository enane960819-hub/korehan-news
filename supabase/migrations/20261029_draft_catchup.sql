-- auto-apply
-- One-off catch-up for 2026-10-29 (owner-approved): the 06:00–06:55 KST
-- daily-article-draft ticks failed with "job startup timeout" while the
-- Nano instance had no disk IO left. Same tick as the morning job, every
-- 4 minutes until 00:35 UTC (09:35 KST, ~12 ticks), then it removes itself.
select cron.unschedule(jobid) from cron.job where jobname = 'daily-article-draft-catchup';
select cron.schedule(
  'daily-article-draft-catchup',
  '*/4 * * * *',
  $$
  do $job$
  begin
    if now() > timestamptz '2026-10-29 00:35:00+00' then
      perform cron.unschedule('daily-article-draft-catchup');
    else
      perform net.http_post(
        url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-article-draft',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
    end if;
  end
  $job$;
  $$
);
