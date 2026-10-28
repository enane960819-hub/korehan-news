-- auto-apply
-- Review queue for AI-made content learners share (content-qa step 6).
-- Root cause of awkward examples / odd meanings: only the weekly topic
-- content went through the reviewer; article analysis, the shared AI caches
-- and the word bank reached learners unreviewed, from many writers (browser,
-- admin tools, crons). Now every row carries qa_at, and a trigger clears it
-- whenever the content changes — so new or regenerated content is always
-- reviewed, whoever wrote it. Idempotent.

alter table public.article_cache          add column if not exists qa_at timestamptz;
alter table public.grammar_examples_cache add column if not exists qa_at timestamptz;
alter table public.vocabulary_bank        add column if not exists qa_at timestamptz;

create index if not exists article_cache_qa_pending_idx on public.article_cache (updated_at desc) where qa_at is null;
create index if not exists gec_qa_pending_idx on public.grammar_examples_cache (updated_at desc) where qa_at is null;
create index if not exists vocab_bank_qa_pending_idx on public.vocabulary_bank (word_key) where qa_at is null;

-- Content changed (and the writer isn't the reviewer setting qa_at) → back in the queue.
create or replace function public.kh_requeue_on_content_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.qa_at is not distinct from old.qa_at
     and (to_jsonb(new) - 'qa_at' - 'updated_at' - 'created_at' - 'is_active' - 'frequency')
         is distinct from
         (to_jsonb(old) - 'qa_at' - 'updated_at' - 'created_at' - 'is_active' - 'frequency') then
    new.qa_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists kh_requeue_article_cache on public.article_cache;
create trigger kh_requeue_article_cache before update on public.article_cache
  for each row execute function public.kh_requeue_on_content_change();
drop trigger if exists kh_requeue_gec on public.grammar_examples_cache;
create trigger kh_requeue_gec before update on public.grammar_examples_cache
  for each row execute function public.kh_requeue_on_content_change();
drop trigger if exists kh_requeue_vocab_bank on public.vocabulary_bank;
create trigger kh_requeue_vocab_bank before update on public.vocabulary_bank
  for each row execute function public.kh_requeue_on_content_change();

-- Old cache versions no code reads any more (current: kex5::, kex_sit2::).
delete from public.grammar_examples_cache
 where pattern_name like 'kex::%' or pattern_name like 'kex_sit::%' or pattern_name like 'kex4::%';

-- Clear the existing backlog faster than the hourly run: a temporary job
-- calls content-qa {only:'queue'} every 4 minutes and removes itself once
-- nothing is waiting. New content after that is reviewed hourly.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'content-qa-queue-fill') then
    perform cron.unschedule('content-qa-queue-fill');
  end if;
end $$;
select cron.schedule(
  'content-qa-queue-fill',
  '*/4 * * * *',
  $cron$
  do $job$
  begin
    if exists (select 1 from public.vocabulary_bank where qa_at is null)
       or exists (select 1 from public.article_cache where qa_at is null)
       or exists (select 1 from public.grammar_examples_cache where qa_at is null) then
      perform net.http_post(
        url     := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/content-qa',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
        ),
        body    := '{"only":"queue"}'::jsonb,
        timeout_milliseconds := 150000
      );
    else
      perform cron.unschedule('content-qa-queue-fill');
    end if;
  end
  $job$;
  $cron$
);
