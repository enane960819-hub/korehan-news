-- auto-apply
-- One-off: dry-run today's Korea Buzz pick (no writes; one Haiku call) so
-- supabase/reports/2026-10-12_buzz_dry_run.sql can show the candidate.
-- Same auth path as the daily-article-draft cron (vault cron_secret).
insert into public.app_settings (key, value)
select 'buzz_dry_request_id', net.http_post(
  url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-article-draft',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)),
  body    := '{"buzz":"dry"}'::jsonb,
  timeout_milliseconds := 150000)::text
on conflict (key) do update set value = excluded.value;
