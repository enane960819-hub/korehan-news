-- auto-apply
-- Admin "AI Auto-Generate" runs on the server: the CMS enqueues headlines
-- here and daily-article-draft ({"jobs":true}) builds them one at a time,
-- so closing the admin tab no longer loses the batch. Two kinds:
--   body     → Sonnet body, article saved (draft unless the admin chose published)
--   analysis → enqueued after the admin reviews the body; Haiku sentence
--              analysis + quiz into article_cache
-- Idempotent.

create table if not exists public.article_gen_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('body', 'analysis')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  article_id text,
  result jsonb,
  error text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists article_gen_jobs_status_created on public.article_gen_jobs (status, created_at);
create index if not exists article_gen_jobs_article on public.article_gen_jobs (article_id);

alter table public.article_gen_jobs enable row level security;
drop policy if exists "article_gen_jobs admin read" on public.article_gen_jobs;
create policy "article_gen_jobs admin read" on public.article_gen_jobs
  for select to authenticated using (public.is_admin_email());
drop policy if exists "article_gen_jobs admin delete" on public.article_gen_jobs;
create policy "article_gen_jobs admin delete" on public.article_gen_jobs
  for delete to authenticated using (public.is_admin_email());

-- Worker tick: every minute, only while something is waiting (or a run
-- crashed), at most 2 running at once.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'article-gen-jobs';
select cron.schedule(
  'article-gen-jobs',
  '* * * * *',
  $$
  do $job$
  begin
    if (exists (select 1 from public.article_gen_jobs where status = 'pending')
        and (select count(*) from public.article_gen_jobs
              where status = 'running' and started_at > now() - interval '6 minutes') < 2)
       or exists (select 1 from public.article_gen_jobs
                   where status = 'running' and started_at < now() - interval '6 minutes') then
      perform net.http_post(
        url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-article-draft',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
        ),
        body    := '{"jobs":true}'::jsonb,
        timeout_milliseconds := 150000
      );
    end if;
  end
  $job$;
  $$
);
