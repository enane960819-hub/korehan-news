-- auto-apply
-- Tag the existing vocabulary (~4.4k bank words + saved words) for the Word
-- Universe without waiting a day for the hourly content-qa: a temporary job
-- runs content-qa {only:'tags'} every 3 minutes (≈750 words a run) and
-- unschedules itself once untagged_words() comes back empty. New words after
-- that are picked up by the hourly content-qa run.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'word-tags-fill') then
    perform cron.unschedule('word-tags-fill');
  end if;
end $$;
select cron.schedule(
  'word-tags-fill',
  '*/3 * * * *',
  $cron$
  do $job$
  begin
    if exists (select 1 from public.untagged_words(1)) then
      perform net.http_post(
        url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/content-qa',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
        ),
        body    := '{"only":"tags"}'::jsonb,
        timeout_milliseconds := 150000
      );
    else
      perform cron.unschedule('word-tags-fill');
    end if;
  end
  $job$;
  $cron$
);
