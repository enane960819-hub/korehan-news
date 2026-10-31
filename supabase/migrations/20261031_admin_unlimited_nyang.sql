-- auto-apply
-- Admin = unlimited nyang (owner, 2026-10-31). buy_room_item (20261030_room_slots.sql) already
-- treats the admin as free; this does the same for the profile / gift / boost shop: the admin pays
-- 0 and is never short. The admin is public.is_admin_email() (signed JWT email), the same rule
-- kh_my_roles() reports to the client. Everyone else is unchanged (20261026_coin_server_only.sql).
create or replace function public.purchase_coin_shop_item(p_user_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item public.shop_items%rowtype;
  v_coin bigint;
  v_owned int;
  v_new_coin bigint;
  v_price bigint;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_item from public.shop_items where id = p_item_id and is_active = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND'); end if;
  if not v_item.can_buy_with_coin then return jsonb_build_object('ok', false, 'error', 'COIN_NOT_ALLOWED'); end if;

  v_price := case when coalesce(public.is_admin_email(), false) then 0 else coalesce(v_item.coin_price, 0) end;
  select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id for update;
  if coalesce(v_coin, 0) < v_price then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_COIN');
  end if;

  select quantity into v_owned from public.owned_items where user_id = p_user_id and item_id = p_item_id;
  if coalesce(v_owned,0) > 0 and not v_item.is_repeatable then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_OWNED');
  end if;

  v_new_coin := coalesce(v_coin, 0) - v_price;
  update public.user_stats set coin_balance = v_new_coin where user_id = p_user_id;
  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  values (p_user_id, 'spend', -v_price, v_new_coin, 'shop_purchase', p_item_id, v_item.name);
  insert into public.shop_purchases(user_id, item_id, purchase_type, coin_spent, payment_status)
  values (p_user_id, p_item_id, 'coin', v_price, 'completed');
  insert into public.owned_items(user_id, item_id, quantity)
  values (p_user_id, p_item_id, 1)
  on conflict (user_id, item_id)
  do update set quantity = public.owned_items.quantity + case when v_item.is_repeatable then 1 else 0 end;
  return jsonb_build_object('ok', true, 'coin_balance', v_new_coin);
end;
$function$;
