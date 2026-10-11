-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Weekend Live Class — Premium only, Zoom link private, weekly auto-session
-- ═════════════════════════════════════════════════════════════════════
-- 1. zoom_link was readable by anyone through the public select policy.
--    Column privileges now hide it; registered Premium learners get it
--    through get_live_zoom_link() once registration closes (or 30 min
--    before start / live / for the recording afterwards).
-- 2. Registration requires Premium (admin exempt).
-- 3. kh_ensure_weekly_live_session() creates "this week's" Sunday 21:00 KST
--    class if none exists, using the recurring Zoom link stored in
--    app_settings 'live_class_zoom_link' (admin CMS → Settings). pg_cron
--    runs it every Monday 00:05 KST. Idempotent.

revoke select on public.weekly_live_sessions from anon, authenticated;
grant select (id, title, description, scheduled_at, registration_deadline,
              max_attendees, is_cancelled, created_by, created_at, updated_at)
  on public.weekly_live_sessions to anon, authenticated;
grant insert, update, delete on public.weekly_live_sessions to authenticated; -- still gated by wls_admin_write

drop policy if exists "wlr_self_insert" on public.weekly_live_registrations;
create policy "wlr_self_insert"
  on public.weekly_live_registrations for insert
  with check (auth.uid() = user_id and (public.kh_is_premium(auth.uid()) or public.is_admin_email()));

create or replace function public.get_live_zoom_link(p_session uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  s public.weekly_live_sessions%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then return null; end if;
  select * into s from public.weekly_live_sessions where id = p_session and not is_cancelled;
  if not found then return null; end if;
  if public.is_admin_email() then return s.zoom_link; end if;
  if not public.kh_is_premium(v_user) then return null; end if;
  if not exists (select 1 from public.weekly_live_registrations where session_id = p_session and user_id = v_user) then
    return null;
  end if;
  if now() < least(coalesce(s.registration_deadline, s.scheduled_at), s.scheduled_at - interval '30 minutes') then
    return null;
  end if;
  return s.zoom_link;
end;
$$;
revoke execute on function public.get_live_zoom_link(uuid) from public;
grant  execute on function public.get_live_zoom_link(uuid) to authenticated;

create or replace function public.kh_ensure_weekly_live_session()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_monday date := date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;
  v_start  timestamptz := ((v_monday + 6)::timestamp + time '21:00') at time zone 'Asia/Seoul';
  v_id     uuid;
  v_zoom   text;
begin
  select id into v_id from public.weekly_live_sessions
   where scheduled_at >= (v_monday::timestamp at time zone 'Asia/Seoul')
     and scheduled_at <  ((v_monday + 7)::timestamp at time zone 'Asia/Seoul')
   limit 1;
  if v_id is not null then return v_id; end if;
  select value into v_zoom from public.app_settings where key = 'live_class_zoom_link';
  insert into public.weekly_live_sessions (title, description, scheduled_at, registration_deadline, zoom_link)
  values ('Weekend Live Class',
          'This week''s topic, tricky grammar from the week''s articles, and live Q&A. 60 minutes on Zoom.',
          v_start, v_start - interval '1 hour', nullif(btrim(coalesce(v_zoom, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.kh_ensure_weekly_live_session() from public;

-- Run now (creates this week's class) and every Monday 00:05 KST.
select public.kh_ensure_weekly_live_session();

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'weekly-live-session';
select cron.schedule('weekly-live-session', '5 15 * * 0', $$select public.kh_ensure_weekly_live_session();$$);
