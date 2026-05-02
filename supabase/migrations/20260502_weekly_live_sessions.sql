-- Weekly Live Review (Zoom sessions) — admin schedules a session, users
-- register, the Zoom link is revealed once registration closes.
--
-- Two tables:
--   weekly_live_sessions       — one row per scheduled live class
--   weekly_live_registrations  — one row per user who registered
--
-- RLS rules:
--   * Sessions are publicly readable (so guests can see the schedule on
--     the courses page) but only admins (app_settings.admin_user_ids)
--     can write. The zoom_link column is intentionally readable too —
--     enforcement of "show link only to registered users after the
--     deadline" is done client-side via cpRenderLiveCard. If you need
--     server-side enforcement, hide zoom_link from the SELECT policy and
--     expose it via an RPC that checks registration + deadline.
--   * Registrations are owned per-user (auth.uid() = user_id).

create table if not exists weekly_live_sessions (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  scheduled_at           timestamptz not null,
  registration_deadline  timestamptz,
  zoom_link              text,
  max_attendees          int,
  is_cancelled           boolean not null default false,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists weekly_live_sessions_scheduled_idx
  on weekly_live_sessions (scheduled_at);

create table if not exists weekly_live_registrations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references weekly_live_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  email_sent  boolean not null default false,
  registered_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists weekly_live_registrations_session_idx
  on weekly_live_registrations (session_id);
create index if not exists weekly_live_registrations_user_idx
  on weekly_live_registrations (user_id);

-- ── RLS ───────────────────────────────────────────────────────
alter table weekly_live_sessions      enable row level security;
alter table weekly_live_registrations enable row level security;

-- Sessions: everyone can read, only admins can mutate.
drop policy if exists "wls_public_read" on weekly_live_sessions;
create policy "wls_public_read"
  on weekly_live_sessions for select
  using (true);

drop policy if exists "wls_admin_write" on weekly_live_sessions;
create policy "wls_admin_write"
  on weekly_live_sessions for all
  using (
    exists (
      select 1 from app_settings
      where key = 'admin_user_ids'
        and value::jsonb ? auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from app_settings
      where key = 'admin_user_ids'
        and value::jsonb ? auth.uid()::text
    )
  );

-- Registrations: each user owns their own row. Reading other users'
-- registrations is exposed only as a count via the courses page (which
-- does a client-side aggregate). If you need true privacy, swap this for
-- a SECURITY DEFINER count function.
drop policy if exists "wlr_self_read" on weekly_live_registrations;
create policy "wlr_self_read"
  on weekly_live_registrations for select
  using (auth.uid() = user_id);

drop policy if exists "wlr_count_read" on weekly_live_registrations;
create policy "wlr_count_read"
  on weekly_live_registrations for select
  using (true);
-- (the previous self-read policy is redundant once the broad read is on,
--  but keeping both makes intent explicit. Both are SELECT-only.)

drop policy if exists "wlr_self_insert" on weekly_live_registrations;
create policy "wlr_self_insert"
  on weekly_live_registrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "wlr_self_delete" on weekly_live_registrations;
create policy "wlr_self_delete"
  on weekly_live_registrations for delete
  using (auth.uid() = user_id);
