-- claim_streak_award fails for everyone: notifications_kind_check rejects
-- kind 'streak_award'. Find what writes that kind on the live DB.
select json_build_object(
  'claim_fn', (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'claim_streak_award' limit 1),
  'writers', (select json_agg(json_build_object('fn', n.nspname || '.' || p.proname)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosrc ilike '%''streak_award''%'),
  'profile_triggers', (select json_agg(json_build_object('trigger', t.tgname, 'fn', p.proname)) from pg_trigger t join pg_proc p on p.oid = t.tgfoid
              where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal),
  'kind_check', (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conname = 'notifications_kind_check'),
  'awards_ever', (select count(*) from public.notifications where kind in ('streak_freeze_awarded', 'streak_award'))
);
