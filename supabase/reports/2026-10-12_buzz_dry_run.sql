-- Korea Buzz dry-run result (read-only): the pg_net response of the request
-- fired by migrations/20261012_buzz_dry_run.sql, plus section/column checks.
select json_build_object(
  'status', r.status_code,
  'timed_out', r.timed_out,
  'error', r.error_msg,
  'body', left(r.content, 4000),
  'buzz_section', (select row_to_json(s) from public.sections s where key = 'buzz'),
  'netizen_talk_col', exists (select 1 from information_schema.columns where table_schema='public' and table_name='articles' and column_name='netizen_talk'),
  'pexels_key_set', exists (select 1 from public.app_settings where key='pexels_key' and coalesce(value,'') <> '')
) as report
from public.app_settings a
left join net._http_response r on r.id = a.value::bigint
where a.key = 'buzz_dry_request_id';
