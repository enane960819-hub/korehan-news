-- Read-only RLS sweep: public tables with RLS off, and permissive policies
-- (USING/CHECK true or no user scoping) that let clients read/write others' rows.
select json_build_object(
  'rls_disabled', (select json_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
  'open_policies', (select json_agg(json_build_object('t', tablename, 'p', policyname, 'cmd', cmd, 'roles', roles, 'qual', left(coalesce(qual,''),120), 'check', left(coalesce(with_check,''),120)) order by tablename)
                    from pg_policies where schemaname='public'
                      and (coalesce(qual,'') in ('true','(true)') or coalesce(with_check,'') in ('true','(true)')
                           or (cmd in ('INSERT','UPDATE','DELETE','ALL') and coalesce(qual,'')||coalesce(with_check,'') not like '%auth.%' and coalesce(qual,'')||coalesce(with_check,'') not like '%is_admin%'))),
  'anon_grants_write', (select json_agg(distinct table_name) from information_schema.role_table_grants
                    where table_schema='public' and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE')),
  'buckets', (select json_agg(json_build_object('id', id, 'public', public)) from storage.buckets),
  'storage_policies', (select json_agg(json_build_object('p', policyname, 'cmd', cmd, 'qual', left(coalesce(qual,''),140), 'check', left(coalesce(with_check,''),140))) from pg_policies where schemaname='storage')
) as report;
