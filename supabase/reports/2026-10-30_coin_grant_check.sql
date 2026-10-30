-- Did the owner coin grant land? (The previous report only printed its last
-- statement.) Read-only; prints no email.
select u.id is not null as account_found,
       s.coin_balance,
       (select count(*) from public.coin_transactions t
         where t.user_id = u.id and t.memo = 'Owner grant: unlimited nyang') as ledger_rows
  from (select 1) x
  left join auth.users u on md5(lower(u.email)) = '244d925429b01b8373e4198d16661e2e'
  left join public.user_stats s on s.user_id = u.id;
