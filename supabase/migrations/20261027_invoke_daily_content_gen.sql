-- auto-apply
-- One-shot: run daily-content-gen now (owner topped up Anthropic credits on
-- 2026-10-27; study_daily_content had nothing after 2026-10-19). Same auth as
-- the nightly job (Vault 'cron_secret'). The function only generates
-- (week, level) rows that are missing / on the wrong topic and holds a
-- 15-min lock, so a re-run of this file can't double-bill.
create extension if not exists pg_net;
select net.http_post(
  url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-content-gen',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
  ),
  body    := '{}'::jsonb,
  timeout_milliseconds := 150000
);
