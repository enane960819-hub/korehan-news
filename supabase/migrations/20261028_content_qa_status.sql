-- auto-apply
-- content-qa: the last run's report (what was reviewed, dropped, built or
-- rejected and why) in one row the admin page can read. Holds only content
-- QA notes — no keys or user data.
create table if not exists public.content_qa_status (
  id      int primary key,
  ran_at  timestamptz,
  ms      int,
  report  jsonb
);
alter table public.content_qa_status enable row level security;
drop policy if exists cqs_read on public.content_qa_status;
create policy cqs_read on public.content_qa_status for select using (true);
grant select on public.content_qa_status to anon, authenticated;
