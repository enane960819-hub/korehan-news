-- Read-only: what server-side XP / coin functions exist, and who can
-- write user_stats.coin_balance / xp (planning the move off client writes).
select json_build_object(
  'funcs', (select json_agg(json_build_object(
              'name', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
              'secdef', p.prosecdef,
              'def', case when p.prokind = 'f' then left(pg_get_functiondef(p.oid), 6000) else null end))
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and (p.proname ilike '%xp%' or p.proname ilike '%coin%' or p.proname ilike '%nyang%'
                  or p.proname ilike '%purchase%' or p.proname ilike '%shop%' or p.proname ilike '%nickname%'
                  or p.proname ilike '%gift%' or p.proname ilike '%badge%' or p.proname ilike '%room%')),
  'user_stats_col_privs', (select json_agg(json_build_object('col', column_name, 'priv', privilege_type, 'grantee', grantee))
            from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'user_stats'
             and column_name in ('coin_balance', 'xp', 'total_xp', 'xp_spent', 'display_name')
             and grantee in ('authenticated', 'anon')),
  'user_stats_table_privs', (select json_agg(json_build_object('priv', privilege_type, 'grantee', grantee))
            from information_schema.table_privileges
           where table_schema = 'public' and table_name = 'user_stats' and grantee in ('authenticated', 'anon')),
  'user_stats_policies', (select json_agg(json_build_object('name', policyname, 'cmd', cmd, 'qual', qual, 'check', with_check))
            from pg_policies where schemaname = 'public' and tablename = 'user_stats'),
  'triggers', (select json_agg(json_build_object('table', event_object_table, 'name', trigger_name, 'action', action_statement))
            from information_schema.triggers where event_object_schema = 'public'
             and event_object_table in ('user_stats', 'coin_transactions', 'user_inventory', 'xp_logs', 'user_badges')),
  'coin_tx_cols', (select json_agg(column_name order by ordinal_position) from information_schema.columns
            where table_schema = 'public' and table_name = 'coin_transactions'),
  'inventory_tables', (select json_agg(table_name) from information_schema.tables
            where table_schema = 'public' and (table_name ilike '%inventor%' or table_name ilike '%room%' or table_name ilike '%shop%' or table_name ilike '%gift%' or table_name ilike '%xp_log%'))
);
