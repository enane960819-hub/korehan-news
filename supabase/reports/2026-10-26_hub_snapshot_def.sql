-- Read-only: definition of get_learning_hub_snapshot (it errors with
-- "operator does not exist: date - bigint") + what read events look like.
select json_build_object(
  'defs', (select json_agg(json_build_object('args', pg_get_function_identity_arguments(p.oid), 'def', pg_get_functiondef(p.oid)))
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'get_learning_hub_snapshot'),
  'activity_types_30d', (select json_object_agg(activity_type, n) from (
      select activity_type, count(*) n from public.user_activity_log
       where study_date >= current_date - 30 group by 1) x),
  'read_history_30d', (select count(*) from public.user_read_history where read_at >= now() - interval '30 days'),
  'log_read_event_def', (select left(pg_get_functiondef(p.oid), 2500) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'log_read_event' limit 1)
);
