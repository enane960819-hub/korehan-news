-- auto-apply
-- content-qa: automatic quality gate for generated learning content
-- (weekly study content, Key Expressions, writing-flow topic packs).
-- See supabase/functions/content-qa/index.ts.

-- When the week's row was last reviewed + what was removed.
alter table public.study_daily_content add column if not exists qa_at timestamptz;
alter table public.study_daily_content add column if not exists qa_report jsonb;

-- Run log: pack attempts per topic (capped so a failing topic is never
-- re-billed forever) and the single-run lock. Service role only.
create table if not exists public.content_qa_runs (
  key        text primary key,
  attempts   int not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.content_qa_runs enable row level security;
revoke all on public.content_qa_runs from anon, authenticated;

-- Hourly at :17. Cheap when there is nothing new (DB reads only); AI calls
-- happen only for content that was (re)generated since the last check.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'content-qa') then
    perform cron.unschedule('content-qa');
  end if;
end $$;
select cron.schedule(
  'content-qa',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/content-qa',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
