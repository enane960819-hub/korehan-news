-- Monthly Reports
-- Stores the per-month aggregated stats and (optionally) the
-- Claude-generated study plan. One row per (user_id, month_start)
-- where month_start is the first day of the calendar month, e.g.
-- 2026-04-01 for the April 2026 report.
--
-- stats schema (jsonb):
--   { articles_read, words_saved, quizzes_done, writing_count,
--     writing_avg_score, accuracy_pct, active_days,
--     skill_reading, skill_vocab, skill_grammar, skill_writing,
--     skill_listening, skill_speaking,
--     weak_grammar:[{grammar_point, wrong_count}],
--     weekly:[{week_start, xp, articles, words, ...}] }
--
-- ai_plan schema (jsonb, nullable until generated):
--   { summary, focus_areas:[...], weekly_goals:[
--       {week:1, articles, words, quizzes, writing, focus},
--       ...
--     ], encouragement }

create table if not exists user_monthly_reports (
  user_id      uuid not null references auth.users(id) on delete cascade,
  month_start  date not null,
  generated_at timestamptz not null default now(),
  stats        jsonb not null default '{}'::jsonb,
  ai_plan      jsonb,
  ai_plan_at   timestamptz,
  primary key (user_id, month_start)
);

create index if not exists user_monthly_reports_month_idx
  on user_monthly_reports(month_start desc);

alter table user_monthly_reports enable row level security;

drop policy if exists "user reads own monthly reports" on user_monthly_reports;
create policy "user reads own monthly reports"
  on user_monthly_reports for select
  using (auth.uid() = user_id);

drop policy if exists "user writes own monthly reports" on user_monthly_reports;
create policy "user writes own monthly reports"
  on user_monthly_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "user updates own monthly reports" on user_monthly_reports;
create policy "user updates own monthly reports"
  on user_monthly_reports for update
  using (auth.uid() = user_id);
