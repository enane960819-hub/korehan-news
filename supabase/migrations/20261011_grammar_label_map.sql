-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- grammar_label_map — article grammar labels → Grammar Path lessons
-- ═════════════════════════════════════════════════════════════════════
-- The nightly harvest in daily-article-draft (idle tick, once a day) reads
-- the grammar labels that article analysis produced, and records a verdict
-- for every label it hasn't seen before:
--   existing → same grammar as a curriculum pattern (pattern = that row)
--   new      → real grammar the curriculum lacked; added to
--              grammar_curriculum as tier='library' (pattern = new row)
--   skip     → vocabulary / collocation, not grammar (pattern = null)
-- The Study Room reads existing/new rows so an article's 📚 link opens
-- the shared lesson. label_norm must match _gcNorm() in
-- korehan-study-room.js and gcNorm() in the Edge Function.
-- Idempotent.

create table if not exists public.grammar_label_map (
  label_norm  text primary key check (length(label_norm) between 1 and 200),
  label       text not null check (length(label) <= 300),
  verdict     text not null check (verdict in ('existing','new','skip')),
  pattern     text,
  decided_at  timestamptz not null default now()
);

alter table public.grammar_label_map enable row level security;
drop policy if exists grammar_label_map_read on public.grammar_label_map;
create policy grammar_label_map_read on public.grammar_label_map
  for select using (true);
-- Writes: service role only (Edge Function / admin-api).

alter table public.grammar_curriculum
  add column if not exists source text not null default 'curriculum';
