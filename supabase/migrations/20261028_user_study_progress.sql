-- auto-apply
-- Article / conversation study progress. The client wrote and read
-- user_read_history.progress_data, a column that never existed (PostgREST
-- 400) — so progress never synced across devices and "studied" articles
-- were never marked. One row per user + content, owner-only.
create table if not exists public.user_study_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_id   text not null,
  progress     jsonb not null default '{}'::jsonb,
  completed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);
alter table public.user_study_progress enable row level security;
drop policy if exists usp_select on public.user_study_progress;
drop policy if exists usp_insert on public.user_study_progress;
drop policy if exists usp_update on public.user_study_progress;
drop policy if exists usp_delete on public.user_study_progress;
create policy usp_select on public.user_study_progress for select using (auth.uid() = user_id);
create policy usp_insert on public.user_study_progress for insert with check (auth.uid() = user_id);
create policy usp_update on public.user_study_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy usp_delete on public.user_study_progress for delete using (auth.uid() = user_id);

-- Articles finished before this table existed were logged in
-- user_submissions (content_type article_study) — carry them over.
insert into public.user_study_progress (user_id, content_type, content_id, progress, completed, updated_at)
select distinct on (s.user_id, s.content_id) s.user_id, 'article_study', s.content_id, '{"completed": true}'::jsonb, true, coalesce(s.updated_at, now())
  from public.user_submissions s
 where s.content_type = 'article_study' and s.content_id is not null
 order by s.user_id, s.content_id, s.updated_at desc
on conflict (user_id, content_type, content_id) do nothing;
