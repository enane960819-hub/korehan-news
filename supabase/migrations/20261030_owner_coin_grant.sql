-- auto-apply
-- Owner request 2026-10-30: give one account effectively unlimited nyang.
-- The account is matched by md5 of its lower-cased email so the address
-- itself never sits in the repo. Tops the balance up to 9,999,999 (prices
-- top out at 1,500) and writes the usual admin_adjust ledger row. Re-running
-- only tops up again if the balance has dropped below 9,000,000.
do $$
declare
  v_uid uuid;
  v_cur bigint;
  v_target constant bigint := 9999999;
begin
  select id into v_uid from auth.users
   where md5(lower(email)) = '244d925429b01b8373e4198d16661e2e'
   limit 1;
  if v_uid is null then
    raise notice 'owner_coin_grant: account not found (not signed up yet)';
    return;
  end if;

  insert into public.user_stats (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  select coalesce(coin_balance, 0) into v_cur
    from public.user_stats where user_id = v_uid for update;
  if v_cur >= 9000000 then
    raise notice 'owner_coin_grant: already topped up (%)', v_cur;
    return;
  end if;

  update public.user_stats set coin_balance = v_target where user_id = v_uid;
  insert into public.coin_transactions (user_id, tx_type, amount, balance_after, source, memo)
  values (v_uid, 'admin_adjust', v_target - v_cur, v_target, 'admin', 'Owner grant: unlimited nyang');
  raise notice 'owner_coin_grant: % -> %', v_cur, v_target;
end $$;
