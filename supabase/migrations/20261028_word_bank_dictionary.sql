-- auto-apply
-- Word Bank expansion from 한국어기초사전 (NIKL Basic Korean Dictionary,
-- CC BY-SA 2.0 KR). Rows imported from it carry source='krdict', the
-- dictionary's part of speech and its first human-written example sentence.
-- They are not AI output, so the import marks them reviewed (qa_at) instead of
-- sending ~6k rows through the paid content-qa queue. Idempotent.
alter table public.vocabulary_bank add column if not exists pos text;
alter table public.vocabulary_bank add column if not exists example_ko text;
alter table public.vocabulary_bank add column if not exists source text;
create index if not exists vocabulary_bank_level_active on public.vocabulary_bank (level) where is_active;
