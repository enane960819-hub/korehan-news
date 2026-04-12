-- Newsletter subscribers table
create table if not exists public.newsletter_subs (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  active boolean not null default true,
  subscribed_at timestamptz not null default now()
);

-- RLS
alter table public.newsletter_subs enable row level security;

-- Anyone can insert (subscribe)
create policy "Anyone can subscribe"
  on public.newsletter_subs
  for insert
  with check (true);

-- Only service role can read/update/delete (admin)
create policy "Service role can read all"
  on public.newsletter_subs
  for select
  using (auth.role() = 'service_role');

create policy "Service role can update"
  on public.newsletter_subs
  for update
  using (auth.role() = 'service_role');

create policy "Service role can delete"
  on public.newsletter_subs
  for delete
  using (auth.role() = 'service_role');
