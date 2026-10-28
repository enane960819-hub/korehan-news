-- Every non-SELECT policy that any signed-in (or anonymous) user passes
-- without an ownership/admin check (read-only sweep).
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public' and cmd <> 'SELECT'
  and (
    coalesce(qual, '') ~* '^\(?(true|\(auth\.uid\(\) is not null\)|auth\.uid\(\) is not null|\(auth\.role\(\) = ''authenticated''::text\))\)?$'
    or coalesce(with_check, '') ~* '^\(?(true|\(auth\.uid\(\) is not null\)|auth\.uid\(\) is not null|\(auth\.role\(\) = ''authenticated''::text\))\)?$'
    or (qual is null and with_check is null)
  )
order by tablename, cmd;
