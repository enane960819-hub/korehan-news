-- auto-apply
-- Cost visibility + spend guards. Idempotent.

-- 1) Cron Anthropic spend was NEVER recorded. claude_api_usage.user_id was
--    NOT NULL, so every cron insert (user_id = null in daily-article-draft /
--    daily-content-gen / phone-call-gen) silently failed its best-effort insert.
--    That is why the cost dashboard showed almost nothing. Make it nullable so
--    cron/system calls land in the same telemetry table as proxied user calls.
alter table public.claude_api_usage alter column user_id drop not null;

-- 2) Regeneration guard. daily-content-gen now re-generates rows written under
--    the old (thin) schema so they pick up the richer pools. Cap the attempts
--    per row so a row that never reaches the "enriched" bar (helpers >= 7 and
--    grammar examples present) can't be re-generated — and re-billed — on every
--    nightly run forever.
alter table public.study_daily_content
  add column if not exists enrich_attempts int not null default 0;

-- 3) The cost-aggregation jobs defined in 20260527 were never scheduled, so the
--    durable claude_cost_daily rollup + per-feature materialized view stayed
--    empty (claude_api_usage keeps 365 days, but nothing rolled it up for the
--    dashboard). Schedule them now. Non-concurrent refresh so it works without a
--    unique index on the view. Times are UTC (16:00 UTC = 01:00 KST next day,
--    after the 02:00-KST content cron and the 06:00-KST article cron).
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job
 where jobname in ('claude_cost_daily', 'refresh_cost_view');

select cron.schedule('claude_cost_daily', '0 16 * * *',
  $$ select public.aggregate_claude_costs_daily(); $$);

select cron.schedule('refresh_cost_view', '10 16 * * *',
  $$ refresh materialized view public.claude_cost_by_feature_month; $$);
