-- Read-only: app_settings key NAMES (never values) readable as anon.
begin;
set local role anon;
select json_agg(key order by key) as anon_readable_keys from public.app_settings;
