-- Read-only: remaining definitions needed to lock down coin writes.
select json_build_object(
  'send_reporter_gift', (select substr(pg_get_functiondef(p.oid), 1, 20000) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'send_reporter_gift' limit 1),
  'is_admin_email', (select json_agg(json_build_object('args', pg_get_function_identity_arguments(p.oid), 'def', substr(pg_get_functiondef(p.oid), 1, 3000)))
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_admin_email'),
  'xp_config', (select json_agg(json_build_object('k', action_key, 'xp', xp_amount, 'on', is_active)) from public.xp_config),
  'xp_log_cols', (select json_agg(column_name order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'xp_log'),
  'user_stats_cols', (select json_agg(column_name order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'user_stats'),
  'fn_exec_privs', (select json_agg(json_build_object('fn', routine_name, 'grantee', grantee))
            from information_schema.routine_privileges where routine_schema = 'public'
             and routine_name in ('admin_adjust_coin', 'purchase_coin_shop_item', 'send_reporter_gift', 'award_xp', 'buy_room_item')
             and grantee in ('anon', 'authenticated', 'PUBLIC')),
  'coin_tx_30d', (select json_agg(x) from (select source, tx_type, count(*) n, sum(amount) total from public.coin_transactions
            where created_at > now() - interval '30 days' group by 1, 2 order by 3 desc limit 30) x),
  'admin_adjust_30d', (select json_agg(x) from (select user_id, amount, memo, created_at from public.coin_transactions
            where tx_type = 'admin_adjust' and created_at > now() - interval '90 days' order by created_at desc limit 20) x),
  'top_balances', (select json_agg(x) from (select coin_balance from public.user_stats order by coin_balance desc nulls last limit 10) x)
);
