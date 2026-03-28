-- Study Room restructure: credits, progress, grammar focus, picture prompts/admin ops

create table if not exists public.study_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credit_balance int not null default 3,
  pass_active_date date,
  last_entry_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_daily_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null,
  topic_done boolean not null default false,
  grammar_done boolean not null default false,
  picture_done boolean not null default false,
  sentence_done boolean not null default false,
  submitted boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, study_date)
);

create table if not exists public.study_picture_prompts (
  id text primary key,
  prompt_ko text not null,
  image_url text not null,
  sample_answer text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_grammar_focus_items (
  id uuid primary key default gen_random_uuid(),
  grammar_key text not null,
  title text not null,
  explanation text,
  level text,
  examples jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_study_grammar_focus_key on public.study_grammar_focus_items(grammar_key);

create table if not exists public.study_grammar_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  grammar_key text not null,
  completed_at timestamptz,
  start_writing_clicked boolean not null default false,
  attempt_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, grammar_key)
);

alter table public.study_user_access enable row level security;
alter table public.study_daily_progress enable row level security;
alter table public.study_picture_prompts enable row level security;
alter table public.study_grammar_focus_items enable row level security;
alter table public.study_grammar_progress enable row level security;

drop policy if exists study_user_access_select_own on public.study_user_access;
create policy study_user_access_select_own on public.study_user_access
for select to authenticated using (auth.uid() = user_id);

drop policy if exists study_user_access_upsert_own on public.study_user_access;
create policy study_user_access_upsert_own on public.study_user_access
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists study_daily_progress_select_own on public.study_daily_progress;
create policy study_daily_progress_select_own on public.study_daily_progress
for select to authenticated using (auth.uid() = user_id);

drop policy if exists study_daily_progress_upsert_own on public.study_daily_progress;
create policy study_daily_progress_upsert_own on public.study_daily_progress
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists study_grammar_progress_select_own on public.study_grammar_progress;
create policy study_grammar_progress_select_own on public.study_grammar_progress
for select to authenticated using (auth.uid() = user_id);

drop policy if exists study_grammar_progress_upsert_own on public.study_grammar_progress;
create policy study_grammar_progress_upsert_own on public.study_grammar_progress
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists study_picture_prompts_read_all on public.study_picture_prompts;
create policy study_picture_prompts_read_all on public.study_picture_prompts
for select to authenticated using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists study_picture_prompts_admin_write on public.study_picture_prompts;
create policy study_picture_prompts_admin_write on public.study_picture_prompts
for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists study_grammar_focus_read_all on public.study_grammar_focus_items;
create policy study_grammar_focus_read_all on public.study_grammar_focus_items
for select to authenticated using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists study_grammar_focus_admin_write on public.study_grammar_focus_items;
create policy study_grammar_focus_admin_write on public.study_grammar_focus_items
for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid())) with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select, insert, update on public.study_user_access to authenticated;
grant select, insert, update on public.study_daily_progress to authenticated;
grant select on public.study_picture_prompts to authenticated;
grant select, insert, update on public.study_grammar_progress to authenticated;
grant select on public.study_grammar_focus_items to authenticated;
