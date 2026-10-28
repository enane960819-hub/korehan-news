-- auto-apply
-- TOPIK-style practice (mockup K, 2026-10-28). ORIGINAL questions in the
-- TOPIK format — written in scripts/topik/items.mjs and seeded by
-- 20261028_topik_b_seed.sql. Free tests are readable by everyone; the other
-- tests' items only by Premium members (and admin). Attempts are per learner.
create table if not exists public.topik_tests (
  id         text primary key,
  level      text not null check (level in ('I', 'II')),
  section    text not null,
  kind       text not null check (kind in ('full', 'mini')),
  title      text not null,
  minutes    int not null default 60,
  free       boolean not null default false,
  sort       int not null default 100,
  status     text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create table if not exists public.topik_items (
  id           text primary key,
  test_id      text not null references public.topik_tests(id) on delete cascade,
  n            int not null,
  type         text not null,
  group_key    text,
  passage      text,
  question     text,
  choices      jsonb not null,
  answer       int not null check (answer between 1 and 4),
  explanation  text,
  qa_at        timestamptz,
  qa_flag      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists topik_items_test_idx on public.topik_items (test_id, n);
create table if not exists public.topik_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  test_id     text not null references public.topik_tests(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,
  correct     int not null,
  total       int not null,
  score       int not null,
  by_type     jsonb not null default '{}'::jsonb,
  est_level   text,
  seconds     int,
  finished_at timestamptz not null default now()
);
create index if not exists topik_attempts_user_idx on public.topik_attempts (user_id, finished_at desc);

alter table public.topik_tests enable row level security;
alter table public.topik_items enable row level security;
alter table public.topik_attempts enable row level security;

drop policy if exists "topik_tests_read" on public.topik_tests;
create policy "topik_tests_read" on public.topik_tests for select
  using (status = 'published' or public.is_admin_email());
drop policy if exists "topik_tests_admin" on public.topik_tests;
create policy "topik_tests_admin" on public.topik_tests for all
  using (public.is_admin_email()) with check (public.is_admin_email());

drop policy if exists "topik_items_read" on public.topik_items;
create policy "topik_items_read" on public.topik_items for select
  using (public.is_admin_email() or exists (
    select 1 from public.topik_tests t where t.id = test_id and t.status = 'published'
      and (t.free or (auth.uid() is not null and public.kh_is_premium(auth.uid())))));
drop policy if exists "topik_items_admin" on public.topik_items;
create policy "topik_items_admin" on public.topik_items for all
  using (public.is_admin_email()) with check (public.is_admin_email());

drop policy if exists "topik_attempts_own_read" on public.topik_attempts;
create policy "topik_attempts_own_read" on public.topik_attempts for select
  using (user_id = auth.uid() or public.is_admin_email());
drop policy if exists "topik_attempts_own_insert" on public.topik_attempts;
create policy "topik_attempts_own_insert" on public.topik_attempts for insert
  with check (user_id = auth.uid());
drop policy if exists "topik_attempts_own_delete" on public.topik_attempts;
create policy "topik_attempts_own_delete" on public.topik_attempts for delete
  using (user_id = auth.uid());

grant select on public.topik_tests, public.topik_items to anon, authenticated;
grant select, insert, delete on public.topik_attempts to authenticated;

drop trigger if exists topik_items_touch on public.topik_items;
create trigger topik_items_touch before update on public.topik_items
  for each row execute function public.kh_touch_updated_at();
drop trigger if exists kh_requeue_topik_items on public.topik_items;
create trigger kh_requeue_topik_items before update on public.topik_items
  for each row execute function public.kh_requeue_on_content_change();
