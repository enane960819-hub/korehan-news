-- auto-apply
-- TOPIK review, stage 3 (scripts/topik/REVIEW.md): the admin approves each
-- draft in the app; learners can report a question from their results.
alter table public.topik_tests
  add column if not exists approved_at timestamptz;

create table if not exists public.topik_reports (
  id          bigint generated always as identity primary key,
  item_id     text not null references public.topik_items(id) on delete cascade,
  test_id     text not null,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note        text not null check (char_length(note) between 3 and 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, item_id)
);
create index if not exists topik_reports_open on public.topik_reports (created_at) where resolved_at is null;
alter table public.topik_reports enable row level security;

drop policy if exists "topik_reports_insert_own" on public.topik_reports;
create policy "topik_reports_insert_own" on public.topik_reports for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "topik_reports_read" on public.topik_reports;
create policy "topik_reports_read" on public.topik_reports for select to authenticated
  using (user_id = auth.uid() or public.is_admin_email());
drop policy if exists "topik_reports_admin_update" on public.topik_reports;
create policy "topik_reports_admin_update" on public.topik_reports for update to authenticated
  using (public.is_admin_email()) with check (public.is_admin_email());
drop policy if exists "topik_reports_admin_delete" on public.topik_reports;
create policy "topik_reports_admin_delete" on public.topik_reports for delete to authenticated
  using (public.is_admin_email());
grant select, insert, update, delete on public.topik_reports to authenticated;
