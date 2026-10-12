-- Read-only: policies on app_settings / live-class registrations + zoom state.
select json_build_object(
  'app_settings_policies', (select json_agg(json_build_object('name', policyname, 'roles', roles, 'cmd', cmd, 'qual', left(qual, 400))) from pg_policies where schemaname='public' and tablename='app_settings'),
  'wlr_policies', (select json_agg(json_build_object('name', policyname, 'roles', roles, 'cmd', cmd, 'qual', left(qual,160), 'check', left(with_check,160))) from pg_policies where schemaname='public' and tablename='weekly_live_registrations'),
  'this_week_session', (select json_agg(json_build_object('scheduled_at', scheduled_at, 'has_zoom', zoom_link is not null)) from public.weekly_live_sessions where scheduled_at > now() - interval '1 day'),
  'zoom_setting_set', exists (select 1 from public.app_settings where key='live_class_zoom_link' and coalesce(value,'')<>'')
) as report;
