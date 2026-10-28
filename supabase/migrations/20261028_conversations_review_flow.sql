-- auto-apply
-- Conversations: draft → review → publish (mockup F, admin side).
-- Generated conversations land as drafts; learners only ever read
-- published rows. Existing rows stay published. Idempotent.
alter table public.conversations_data add column if not exists status text not null default 'published';
alter table public.conversations_data add column if not exists qa_report jsonb;
alter table public.conversations_data add column if not exists qa_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_data_status_chk') then
    alter table public.conversations_data add constraint conversations_data_status_chk check (status in ('draft', 'published'));
  end if;
end $$;

create index if not exists conversations_data_status_idx on public.conversations_data (status);

-- Learners read published rows; the admin reads everything (writes stay
-- on the existing "conversations_data admin write" policy).
drop policy if exists "conversations_data_public_read" on public.conversations_data;
drop policy if exists "conversations_data public read" on public.conversations_data;
drop policy if exists "conversations_data published read" on public.conversations_data;
create policy "conversations_data published read" on public.conversations_data
  for select using (status = 'published' or public.is_admin_email());
