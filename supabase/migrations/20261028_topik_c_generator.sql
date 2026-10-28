-- auto-apply
-- TOPIK practice at scale: the topik-gen Edge Function writes whole tests
-- from the TOPIK layout spec (_shared/topik-spec.ts), checks every question
-- with a blind second solve, and publishes the test when all questions pass
-- (otherwise it stays a draft with qa_flag on the failing items).
alter table public.topik_tests
  add column if not exists number int,
  add column if not exists source text not null default 'hand',
  add column if not exists flagged int not null default 0;
alter table public.topik_items
  add column if not exists instruction text,
  add column if not exists script jsonb,        -- listening: [{s:'남자'|'여자', t:'…'}]
  add column if not exists media jsonb,         -- e.g. {graph:{title,unit,items:[{label,value}]}}
  add column if not exists audio_url text,
  add column if not exists topic text;
update public.topik_tests set number = 1 where id = 't1-r1' and number is null;
update public.topik_tests set number = 2 where id = 't1-r2' and number is null;

create table if not exists public.topik_gen_jobs (
  id          uuid primary key default gen_random_uuid(),
  level       text not null check (level in ('I', 'II')),
  section     text not null check (section in ('reading', 'listening')),
  status      text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  progress    jsonb not null default '{}'::jsonb,
  test_id     text,
  error       text,
  ticks       int not null default 0,
  started_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists topik_gen_jobs_status on public.topik_gen_jobs (status, created_at);
alter table public.topik_gen_jobs enable row level security;
drop policy if exists "topik_gen_jobs admin" on public.topik_gen_jobs;
create policy "topik_gen_jobs admin" on public.topik_gen_jobs for all to authenticated
  using (public.is_admin_email()) with check (public.is_admin_email());

-- Worker tick every minute while jobs wait; each call does one step
-- (one generation or one check), up to 3 jobs at a time.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'topik-gen-jobs';
select cron.schedule(
  'topik-gen-jobs',
  '* * * * *',
  $$
  do $job$
  declare n int;
  begin
    select count(*) into n from public.topik_gen_jobs where status = 'pending'
       or (status = 'running' and started_at < now() - interval '4 minutes');
    if n > 0 then
      for i in 1..least(n, 3) loop
        perform net.http_post(
          url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/topik-gen',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
          ),
          body    := '{"action":"tick"}'::jsonb,
          timeout_milliseconds := 150000
        );
      end loop;
    end if;
  end
  $job$;
  $$
);
