-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- article_analyze_log — first-reader sentence analysis (article-analyze)
-- ═════════════════════════════════════════════════════════════════════
-- A signed-in reader tapping a sentence of an article with no cached
-- analysis calls the article-analyze Edge Function, which bakes the whole
-- article once and stores it in article_cache for everyone. This log is
-- both the per-article lock (one 'running' row per article — the partial
-- unique index makes a second concurrent bake fail fast) and the budget
-- guard (per-user and site-wide 24h counts). Service role only.
-- Idempotent.

create table if not exists public.article_analyze_log (
  id          bigserial primary key,
  article_id  text not null check (length(article_id) between 1 and 100),
  user_id     uuid references auth.users(id) on delete set null,
  status      text not null default 'running' check (status in ('running','done','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists article_analyze_log_running_uq
  on public.article_analyze_log (article_id) where status = 'running';
create index if not exists article_analyze_log_user_idx
  on public.article_analyze_log (user_id, created_at desc);
create index if not exists article_analyze_log_created_idx
  on public.article_analyze_log (created_at desc);

alter table public.article_analyze_log enable row level security;
-- No policies: only the Edge Function (service role) reads / writes.
