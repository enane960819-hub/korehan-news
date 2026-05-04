-- User analytics: per-session timing/device/geo + fine-grained event log.
-- Logged-in users only — anonymous traffic is covered by Plausible (cookieless).
-- All tied to auth.users so account deletion cascades and "delete my data"
-- requests remove every row downstream automatically.
--
-- Two tables:
--   user_sessions  — one row per visit (continuous active period, idle > 30min
--                    starts a new session). Captures device, OS, browser, screen,
--                    timezone, language, country (from edge), referrer, UTM,
--                    and timing endpoints. Duration computed at read time as
--                    (coalesce(ended_at, last_heartbeat_at) - started_at) so
--                    we don't depend on the client honoring a clean unload.
--   user_events    — one row per significant interaction. props is jsonb so we
--                    can add new event types without migrations. session_id
--                    nullable for events fired before the session row settled.
--
-- RLS: each user can read/write only their own rows. Admin reads via service-role
-- through the admin-api Edge Function (same pattern other admin pages use).

-- ──────────────────────────────────────────────────────────────────────────
-- user_sessions
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at         timestamptz not null default now(),
  last_heartbeat_at  timestamptz not null default now(),
  ended_at           timestamptz,
  -- device
  device_type    text,    -- 'mobile' | 'tablet' | 'desktop'
  os             text,    -- 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux'
  browser        text,    -- 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | ...
  user_agent     text,    -- truncated to 500 chars
  screen_w       int,
  screen_h       int,
  viewport_w     int,
  viewport_h     int,
  -- locale / geo
  language       text,    -- navigator.language
  timezone       text,    -- Intl resolved timezone (IANA)
  country        text,    -- 2-letter ISO from CF-IPCountry header (or null)
  -- entry
  referrer       text,
  landing_path   text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  -- denormalized counters (updated by triggers/jobs later if needed)
  page_views     int not null default 0,
  events_count   int not null default 0
);
create index if not exists user_sessions_user_started_idx
  on public.user_sessions (user_id, started_at desc);
create index if not exists user_sessions_started_idx
  on public.user_sessions (started_at desc);
create index if not exists user_sessions_country_idx
  on public.user_sessions (country) where country is not null;

alter table public.user_sessions enable row level security;

drop policy if exists "users insert own session" on public.user_sessions;
create policy "users insert own session" on public.user_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own session" on public.user_sessions;
create policy "users update own session" on public.user_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "users read own sessions" on public.user_sessions;
create policy "users read own sessions" on public.user_sessions
  for select using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- user_events
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.user_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  session_id  uuid references public.user_sessions(id) on delete cascade,
  at          timestamptz not null default now(),
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  page_path   text
);
create index if not exists user_events_user_at_idx
  on public.user_events (user_id, at desc);
create index if not exists user_events_event_at_idx
  on public.user_events (event, at desc);
create index if not exists user_events_session_idx
  on public.user_events (session_id);
-- Generic jsonb path index — supports filters like
--   props->>'article_id' = '...' / props->>'section' = 'culture'
create index if not exists user_events_props_idx
  on public.user_events using gin (props);

alter table public.user_events enable row level security;

drop policy if exists "users insert own events" on public.user_events;
create policy "users insert own events" on public.user_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "users read own events" on public.user_events;
create policy "users read own events" on public.user_events
  for select using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Helpful views for the admin dashboard (Phase 4).
-- Computed at read time so we always reflect the latest heartbeat, no
-- stale-aggregate problem if a session never gets a clean ended_at.
-- ──────────────────────────────────────────────────────────────────────────
create or replace view public.user_sessions_v as
  select
    s.*,
    extract(epoch from (coalesce(s.ended_at, s.last_heartbeat_at) - s.started_at))::int
      as duration_seconds
  from public.user_sessions s;

-- Daily summary per user (DAU, time on site, country, device).
create or replace view public.user_daily_engagement_v as
  select
    user_id,
    (started_at at time zone 'UTC')::date as day_utc,
    count(*) as session_count,
    sum(extract(epoch from (coalesce(ended_at, last_heartbeat_at) - started_at)))::int
      as total_seconds,
    max(device_type) as device_type,
    max(country) as country
  from public.user_sessions
  group by user_id, (started_at at time zone 'UTC')::date;
