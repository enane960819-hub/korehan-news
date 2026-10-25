-- Read-only: confirm authenticated can no longer read user_stats.email.
select json_build_object(
  'auth_can_select_email', has_column_privilege('authenticated', 'public.user_stats', 'email', 'SELECT'),
  'auth_can_select_xp', has_column_privilege('authenticated', 'public.user_stats', 'xp', 'SELECT'),
  'anon_can_select_table', has_table_privilege('anon', 'public.user_stats', 'SELECT')
);
