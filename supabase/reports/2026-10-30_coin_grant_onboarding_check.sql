-- Did the owner coin grant land, and does complete_onboarding run as definer
-- (the user_stats column lock would break it otherwise)? Read-only.
select 'coin_grant' as check, u.id is not null as account_found,
       s.coin_balance,
       (select count(*) from public.coin_transactions t
         where t.user_id = u.id and t.memo = 'Owner grant: unlimited nyang') as ledger_rows
  from (select 1) x
  left join auth.users u on md5(lower(u.email)) = '244d925429b01b8373e4198d16661e2e'
  left join public.user_stats s on s.user_id = u.id;

select 'complete_onboarding' as check, p.proname, p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as args,
       left(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'), 1500) as body
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'complete_onboarding';
