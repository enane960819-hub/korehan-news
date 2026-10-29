-- auto-apply
-- Staging for the extra Word Bank words (scripts/word-bank/extra.py): ungraded
-- 한국어기초사전 headwords ranked by usage frequency. Not shown to learners —
-- meanings are reviewed by hand and only reviewed words are copied into
-- vocabulary_bank by a later migration. Dictionary data (CC BY-SA 2.0 KR), so
-- it is readable by anyone; written only by the service role / workflow.
create table if not exists public.word_bank_candidates (
  ko         text primary key,
  pos        text,
  senses     text,
  example_ko text,
  tag        text,
  freq       int,
  rank       int,
  created_at timestamptz not null default now()
);
alter table public.word_bank_candidates enable row level security;
drop policy if exists word_bank_candidates_read on public.word_bank_candidates;
create policy word_bank_candidates_read on public.word_bank_candidates for select using (true);
