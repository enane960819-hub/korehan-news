-- Vocab Edit Mode save check (read-only): constraints/triggers on vocabulary_bank,
-- recent client errors mentioning vocab, and the last rows written.
select jsonb_build_object(
  'constraints', (select jsonb_agg(jsonb_build_object('name', conname, 'type', contype, 'def', pg_get_constraintdef(oid)))
                  from pg_constraint where conrelid = 'public.vocabulary_bank'::regclass),
  'unique_indexes', (select jsonb_agg(indexdef) from pg_indexes
                     where schemaname = 'public' and tablename = 'vocabulary_bank' and indexdef ilike '%unique%'),
  'triggers', (select jsonb_agg(tgname || ': ' || pg_get_triggerdef(oid)) from pg_trigger
               where tgrelid = 'public.vocabulary_bank'::regclass and not tgisinternal),
  'not_null_no_default', (select jsonb_agg(column_name) from information_schema.columns
                          where table_schema = 'public' and table_name = 'vocabulary_bank'
                            and is_nullable = 'NO' and column_default is null),
  'recent_errors', (select jsonb_agg(jsonb_build_object('at', created_at, 'msg', left(message, 200), 'ctx', left(context::text, 200)))
                    from (select * from public.client_errors
                           where created_at > now() - interval '3 days'
                             and (message ilike '%vocab%' or message ilike '%admin%api%' or context::text ilike '%vocab%')
                           order by created_at desc limit 10) e),
  'columns', (select jsonb_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(left(column_default, 30), '-'))
              from information_schema.columns where table_schema = 'public' and table_name = 'vocabulary_bank'),
  'client_errors_cols', (select jsonb_agg(column_name) from information_schema.columns
                         where table_schema = 'public' and table_name = 'client_errors')
) as report;
