-- Read-only: which app_settings keys can anon / authenticated actually read?
-- (audit: deny-list policy may expose stripe_secret_key etc.). Only key NAMES
-- are returned, never values. Also live-class RLS + this week's zoom state.
begin;
set local role anon;
create temp table _anon_keys on commit drop as select key from public.app_settings;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","email":"probe@example.com"}';
create temp table _auth_keys on commit drop as select key from public.app_settings;
reset role;
select json_build_object(
  'anon_readable_keys', (select json_agg(key order by key) from _anon_keys),
  'auth_readable_keys', (select json_agg(key order by key) from _auth_keys),
  'app_settings_policies', (select json_agg(json_build_object('name', policyname, 'roles', roles, 'cmd', cmd)) from pg_policies where schemaname='public' and tablename='app_settings'),
  'wlr_policies', (select json_agg(json_build_object('name', policyname, 'roles', roles, 'cmd', cmd, 'qual', left(qual,160), 'check', left(with_check,160))) from pg_policies where schemaname='public' and tablename='weekly_live_registrations'),
  'this_week_session', (select json_agg(json_build_object('scheduled_at', scheduled_at, 'has_zoom', zoom_link is not null)) from public.weekly_live_sessions where scheduled_at > now() - interval '1 day'),
  'zoom_setting_set', exists (select 1 from public.app_settings where key='live_class_zoom_link' and coalesce(value,'')<>'')
) as report;
rollback;
