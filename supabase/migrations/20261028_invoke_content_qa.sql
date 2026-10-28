-- auto-apply
-- One-shot: run content-qa once right after it ships instead of waiting for
-- the :17 cron. Same auth as the cron (Vault 'cron_secret'); the function
-- holds a 10-min lock, so a re-run of this file can't double-bill.
create extension if not exists pg_net;
select net.http_post(
  url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/content-qa',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
  ),
  body    := '{}'::jsonb,
  timeout_milliseconds := 150000
);
