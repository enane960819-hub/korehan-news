-- Claude API usage tracking + per-user daily quota.
-- Required by claude-proxy edge function for rate limiting and cost
-- visibility. Without this table, the launch is exposed to runaway
-- Anthropic spend (a malicious or buggy client can hammer the proxy
-- with unlimited requests).

create table if not exists claude_api_usage (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature     text,
  input_tokens  int default 0,
  output_tokens int default 0,
  created_at  timestamptz not null default now()
);

create index if not exists claude_api_usage_user_created_idx
  on claude_api_usage (user_id, created_at desc);

create index if not exists claude_api_usage_created_idx
  on claude_api_usage (created_at desc);

-- RLS: users can read their own usage rows; the edge function uses the
-- service role and bypasses RLS for inserts.
alter table claude_api_usage enable row level security;

drop policy if exists "claude_api_usage_self_select" on claude_api_usage;
create policy "claude_api_usage_self_select"
  on claude_api_usage
  for select
  using (auth.uid() = user_id);

-- Per-user daily quota. Defaults are tuned for a free tier; admins can
-- override on a per-user basis by inserting into user_quota_overrides.
-- Pro/Standard users skip the cap entirely (handled in edge function).
create table if not exists user_quota_overrides (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  daily_call_limit     int,
  daily_token_limit    int,
  reason               text,
  updated_at           timestamptz not null default now()
);

alter table user_quota_overrides enable row level security;
-- No client-side policies — only edge functions / admin manage this.
