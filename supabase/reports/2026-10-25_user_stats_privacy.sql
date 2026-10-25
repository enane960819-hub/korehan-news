-- Read-only: is PII (email etc.) in user_stats readable by other users?
select json_build_object(
  'columns', (select json_agg(column_name order by ordinal_position) from information_schema.columns
               where table_schema = 'public' and table_name = 'user_stats'),
  'policies', (select json_agg(json_build_object('name', policyname, 'cmd', cmd, 'roles', roles, 'using', left(qual, 300)))
                from pg_policies where schemaname = 'public' and tablename = 'user_stats'),
  'grants', (select json_agg(distinct grantee || ':' || privilege_type) from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'user_stats' and grantee in ('anon','authenticated')),
  'rows', (select count(*) from public.user_stats),
  'rows_with_email', (select count(*) from public.user_stats where to_jsonb(user_stats) ? 'email' and to_jsonb(user_stats)->>'email' is not null),
  'email_writers', (select json_agg(p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public'
                       and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) else '' end) ilike '%user_stats%email%'),
  'kh_my_roles', (select count(*) from pg_proc where proname = 'kh_my_roles')
);
