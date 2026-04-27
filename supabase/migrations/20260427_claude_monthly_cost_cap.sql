-- Layer-2 Claude API budget protection: per-user monthly USD spend cap.
-- Replaces the daily call count alone as the binding constraint —
-- an attacker hitting the daily ceiling for a full month was previously
-- capable of ~$60/user/month. This migration makes the proxy reject
-- once a user's accumulated input/output token cost crosses
-- $10/month (Free), $30 (Standard), unlimited (Pro), all overridable
-- per user via user_quota_overrides.
--
-- Depends on: 20260427_claude_api_usage.sql (claude_api_usage,
--             user_quota_overrides). Run that one first if it
--             hasn't been applied yet.

-- 1. Track which model each request used so we can compute cost.
--    Pre-existing rows have NULL — those are conservatively priced
--    as Sonnet in the proxy (over-estimate, never under).
alter table if exists claude_api_usage
  add column if not exists model text;

-- The proxy filters by (user_id, created_at >= monthStart). The
-- composite index from the base migration (claude_api_usage_user_created_idx)
-- already covers that query — no separate monthly index needed.
-- A functional index on date_trunc('month', created_at) would have
-- worked too but adds maintenance cost for no query benefit.

-- 2. Per-user monthly USD cap override. NULL → tier default in proxy.
alter table if exists user_quota_overrides
  add column if not exists monthly_cost_limit_usd numeric(10, 4);

comment on column user_quota_overrides.monthly_cost_limit_usd is
  'Max accumulated Anthropic spend per calendar month, in USD. NULL means use tier default (Free=10, Standard=30, Pro=unlimited). Set to a large number for trusted accounts.';
