-- auto-apply
-- One-off cleanup (owner-approved 2026-10-25): remove saved words that
-- review flows inserted on their own before log_word_review existed.
--   • multi-word "words" (sentences / phrases like 공기 정화 시스템,
--     이거 뭐예요?) saved as source_kind 'manual' — the old RPC default,
--     so they can't be told apart from real saves; all came from the
--     listening quiz / topic vocab / flashcard decks
--   • rows the 3D flashcard deck inserted (source_kind 'flashcard_3d')
-- Placeholder words (뉴스/사회/학교 …) are kept — they may be real saves.
-- Rows are copied to an admin-only backup table first. Only rows created
-- before batch 2 went live (03:50 UTC) are touched — later saves are real.

create table if not exists public.user_saved_words_purged_20261025
  (like public.user_saved_words including defaults);
alter table public.user_saved_words_purged_20261025 enable row level security;
revoke all on public.user_saved_words_purged_20261025 from anon, authenticated;

with gone as (
  delete from public.user_saved_words w
   where w.created_at < timestamptz '2026-10-25 03:50:00+00'
     and ((w.word_ko ~ '\s' and coalesce(w.source_kind, 'manual') = 'manual')
          or w.source_kind = 'flashcard_3d')
  returning w.*
)
insert into public.user_saved_words_purged_20261025 select * from gone;
