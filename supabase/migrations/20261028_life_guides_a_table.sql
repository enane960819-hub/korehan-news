-- auto-apply
-- Life in Korea — practical guides for foreigners (visa, housing, work,
-- health…). Content is written in scripts/life-guides/guides.mjs and seeded
-- by 20261028_life_guides_b_seed.sql. Public read for published rows,
-- admin-only writes. Korean terms/phrases go through the content-qa review
-- queue (qa_at + kh_requeue_on_content_change, content-qa step 6).
create table if not exists public.life_guides (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  category    text not null,
  featured    boolean not null default false,
  sort        int not null default 100,
  title       text not null,
  summary     text not null default '',
  steps       jsonb not null default '[]'::jsonb,   -- ["text with {{ko|en}} terms", …]
  terms       jsonb not null default '[]'::jsonb,   -- [{ko, rom, en}]
  phrases     jsonb not null default '[]'::jsonb,   -- [{ko, en}]
  sources     jsonb not null default '[]'::jsonb,   -- [{name, url}]
  checked_at  date,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  qa_at       timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists life_guides_cat_idx on public.life_guides (category, sort);

alter table public.life_guides enable row level security;
drop policy if exists "life_guides_read" on public.life_guides;
create policy "life_guides_read" on public.life_guides for select
  using (status = 'published' or public.is_admin_email());
drop policy if exists "life_guides_admin_write" on public.life_guides;
create policy "life_guides_admin_write" on public.life_guides for all
  using (public.is_admin_email()) with check (public.is_admin_email());
grant select on public.life_guides to anon, authenticated;

create or replace function public.kh_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists life_guides_touch on public.life_guides;
create trigger life_guides_touch before update on public.life_guides
  for each row execute function public.kh_touch_updated_at();
drop trigger if exists kh_requeue_life_guides on public.life_guides;
create trigger kh_requeue_life_guides before update on public.life_guides
  for each row execute function public.kh_requeue_on_content_change();
