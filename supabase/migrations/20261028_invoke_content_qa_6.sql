-- auto-apply
-- One-shot: run content-qa again after the frame-option validation ships, so the
-- next topic-pack attempt runs now instead of at the next :17 cron.
-- pg_net fires after a delay-free POST; the function deploy lands first in
-- the same push most of the time, and the hourly cron covers it otherwise.
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
