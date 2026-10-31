-- auto-apply
-- Owner 2026-10-31: the chef and doctor outfits are removed (not redrawn with the new character).
-- 1) They leave the catalogue (active = false keeps the rows for history; buy_room_item only sells
--    active items, and a worn removed outfit falls back to the basic tee on every screen).
-- 2) Anyone who paid nyang for one gets it back once: one 'earn' row per purchase, matched by the
--    purchase row id in reference_id, so a re-run never pays twice.
update public.avatar_items set active = false where id in ('av_outfit_chef', 'av_outfit_doctor');

do $$
declare r record; v_bal bigint;
begin
  for r in
    select t.id, t.user_id, -t.amount as paid, t.reference_id
      from public.coin_transactions t
     where t.tx_type = 'spend' and t.amount < 0
       and t.reference_id in ('av_outfit_chef', 'av_outfit_doctor')
       and not exists (select 1 from public.coin_transactions x
                        where x.user_id = t.user_id and x.source = 'refund' and x.reference_id = 'refund:' || t.id::text)
  loop
    update public.user_stats set coin_balance = coalesce(coin_balance, 0) + r.paid
     where user_id = r.user_id returning coin_balance into v_bal;
    insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
    values (r.user_id, 'earn', r.paid, coalesce(v_bal, 0), 'refund', 'refund:' || r.id::text,
            'Refund: ' || case r.reference_id when 'av_outfit_chef' then 'Chef' else 'Doctor' end || ' outfit was retired');
  end loop;
end $$;
