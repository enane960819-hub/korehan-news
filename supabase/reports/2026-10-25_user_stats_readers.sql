-- Read-only: which DB functions / views read user_stats, and do they run as
-- the caller (security invoker)? An invoker reading * or email would break
-- once email loses its column grant.
select json_build_object(
  'functions', (select coalesce(json_agg(json_build_object(
        'name', x.proname, 'definer', x.prosecdef,
        'star', (x.def ~* 'select\s+\*[^;]*user_stats|user_stats\s+\w*\s*%rowtype|user_stats\.\*'),
        'email', (x.def ~* 'email'))), '[]'::json)
      from (select p.proname, p.prosecdef,
                   case when p.prokind = 'f' then pg_get_functiondef(p.oid) else '' end as def
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public') x
     where x.def ilike '%user_stats%'),
  'views', (select coalesce(json_agg(json_build_object('view', v.viewname,
        'invoker', coalesce((select 'security_invoker=true' = any(c.reloptions) from pg_class c where c.relname = v.viewname and c.relnamespace = 'public'::regnamespace), false))), '[]'::json)
      from pg_views v where v.schemaname = 'public' and v.definition ilike '%user_stats%'),
  'triggers', (select coalesce(json_agg(tgname), '[]'::json) from pg_trigger where tgrelid = 'public.user_stats'::regclass and not tgisinternal)
);
