-- Read-only: app_settings key NAMES (never values) readable by a signed-in non-admin.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","email":"probe@example.com"}';
select json_agg(key order by key) as auth_readable_keys from public.app_settings;
