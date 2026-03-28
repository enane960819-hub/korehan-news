-- Ensure reporter gifting objects are visible to PostgREST and usable by authenticated users.

create table if not exists public.reporter_user_affinity (
  user_id uuid not null,
  reporter_id text not null,
  gift_count int not null default 0,
  affinity_points bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, reporter_id)
);

create table if not exists public.reporter_gift_history (
  id bigserial primary key,
  user_id uuid not null,
  reporter_id text not null,
  item_id text not null,
  quantity int not null default 1,
  nyang_spent bigint not null default 0,
  gifted_at timestamptz not null default now()
);

create index if not exists idx_reporter_user_affinity_user on public.reporter_user_affinity(user_id, updated_at desc);
create index if not exists idx_reporter_user_affinity_reporter on public.reporter_user_affinity(reporter_id, updated_at desc);
create index if not exists idx_reporter_gift_history_user on public.reporter_gift_history(user_id, gifted_at desc);
create index if not exists idx_reporter_gift_history_reporter on public.reporter_gift_history(reporter_id, gifted_at desc);

alter table public.reporter_user_affinity enable row level security;
alter table public.reporter_gift_history enable row level security;

drop policy if exists reporter_user_affinity_select_own on public.reporter_user_affinity;
create policy reporter_user_affinity_select_own
on public.reporter_user_affinity
for select
using (auth.uid() = user_id);

drop policy if exists reporter_user_affinity_insert_own on public.reporter_user_affinity;
create policy reporter_user_affinity_insert_own
on public.reporter_user_affinity
for insert
with check (auth.uid() = user_id);

drop policy if exists reporter_user_affinity_update_own on public.reporter_user_affinity;
create policy reporter_user_affinity_update_own
on public.reporter_user_affinity
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists reporter_gift_history_select_own on public.reporter_gift_history;
create policy reporter_gift_history_select_own
on public.reporter_gift_history
for select
using (auth.uid() = user_id);

drop policy if exists reporter_gift_history_insert_own on public.reporter_gift_history;
create policy reporter_gift_history_insert_own
on public.reporter_gift_history
for insert
with check (auth.uid() = user_id);

grant select, insert, update on public.reporter_user_affinity to authenticated;
grant select, insert on public.reporter_gift_history to authenticated;

grant execute on function public.send_reporter_gift(text, text, uuid) to authenticated;

-- Reload PostgREST schema cache so `/rest/v1/reporter_user_affinity` and RPC metadata are visible immediately.
notify pgrst, 'reload schema';
