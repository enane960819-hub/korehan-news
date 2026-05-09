-- Signup notification log + admin webhook config.
-- Backs the notify-signup edge function: stores one row per signup the
-- function processed, drives its dedupe check, and gives the admin a
-- queryable history even when the webhook isn't configured.

create table if not exists signup_notifications_log (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  email            text,
  name             text,
  provider         text,
  email_confirmed  boolean default false,
  webhook_url_set  boolean default false,
  webhook_ok       boolean default false,
  webhook_status   int,
  created_at       timestamptz not null default now()
);

create index if not exists signup_notifications_log_created_idx
  on signup_notifications_log (created_at desc);

alter table signup_notifications_log enable row level security;
-- No client policies — only the edge function (service role) writes,
-- and the admin queries via the admin panel which uses the service key.

-- Optional: webhook URL the function POSTs to. Discord and Slack
-- "incoming webhook" URLs both work — the function sends `{content,
-- text}` which both formats accept. Set this once via:
--
--   INSERT INTO app_settings (key, value)
--   VALUES ('signup_notify_webhook', 'https://discord.com/api/webhooks/...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- If the row is missing, signups are still logged but no push is sent.
