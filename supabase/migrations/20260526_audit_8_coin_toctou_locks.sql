-- ─────────────────────────────────────────────────────────────────────
-- Audit 8 (Payments) — PAY-F2: TOCTOU race on user_stats.coin_balance
-- ─────────────────────────────────────────────────────────────────────
-- Two SECURITY DEFINER RPCs read coin_balance then write it back
-- without a row lock, so two concurrent calls can both see the same
-- pre-deduction balance and both succeed:
--
--   purchase_coin_shop_item:
--     SELECT coin_balance INTO v_coin FROM user_stats WHERE …;
--     IF v_coin < price RETURN insufficient;
--     UPDATE user_stats SET coin_balance = v_coin - price …;
--
-- A user with 100 coins firing two purchase RPCs at the same moment
-- (double-clicking the Buy button, or scripting it) can buy two
-- different 100-coin items for a net spend of 100 coins. The second
-- INSERT into shop_purchases / owned_items / coin_transactions then
-- records balance_after = 0 for both, masking the exploit in the
-- ledger.
--
-- Three sibling RPCs already use FOR UPDATE correctly:
--   - send_reporter_gift           (20260327_send_reporter_gift_rpc_fix.sql:54)
--   - purchase_room_item           (20260424_user_room_state.sql:86)
--   - gacha / streak-freeze / nyang-gifting flows
-- so this is fixing a drift, not introducing a new pattern.
--
-- Fix: replace the two affected functions with copies that take an
-- explicit row lock before the balance read. CREATE OR REPLACE
-- preserves the existing grants and RLS-context behavior.
--
-- OWNER MUST APPLY THIS MIGRATION via Supabase SQL editor or
-- `supabase db push`. Idempotent — CREATE OR REPLACE is safe to
-- re-run.

-- ─── 1. purchase_coin_shop_item ─────────────────────────────────────
create or replace function public.purchase_coin_shop_item(p_user_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item public.shop_items%rowtype;
  v_coin bigint;
  v_owned int;
  v_new_coin bigint;
begin
  select * into v_item from public.shop_items where id = p_item_id and is_active = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND'); end if;
  if not v_item.can_buy_with_coin then return jsonb_build_object('ok', false, 'error', 'COIN_NOT_ALLOWED'); end if;

  -- PAY-F2: lock the row before the read so a concurrent purchase
  -- on the same user serializes here instead of double-spending.
  select coalesce(coin_balance,0) into v_coin
  from public.user_stats
  where user_id = p_user_id
  for update;

  if v_coin < coalesce(v_item.coin_price,0) then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_COIN');
  end if;

  select quantity into v_owned from public.owned_items where user_id = p_user_id and item_id = p_item_id;
  if coalesce(v_owned,0) > 0 and not v_item.is_repeatable then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_OWNED');
  end if;

  v_new_coin := v_coin - coalesce(v_item.coin_price,0);
  update public.user_stats set coin_balance = v_new_coin where user_id = p_user_id;

  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  values (p_user_id, 'spend', -coalesce(v_item.coin_price,0), v_new_coin, 'shop_purchase', p_item_id, v_item.name);

  insert into public.shop_purchases(user_id, item_id, purchase_type, coin_spent, payment_status)
  values (p_user_id, p_item_id, 'coin', coalesce(v_item.coin_price,0), 'completed');

  insert into public.owned_items(user_id, item_id, quantity)
  values (p_user_id, p_item_id, 1)
  on conflict (user_id, item_id)
  do update set quantity = public.owned_items.quantity + case when v_item.is_repeatable then 1 else 0 end;

  return jsonb_build_object('ok', true, 'coin_balance', v_new_coin);
end;
$$;

-- ─── 2. admin_adjust_coin ───────────────────────────────────────────
-- Less exploit-prone than #1 (admin-only path), but the race still
-- exists: two simultaneous admin grants on the same user can both
-- read v_coin = N, both write v_coin + delta — the second write
-- silently clobbers the first. Lock for the same correctness reason.
create or replace function public.admin_adjust_coin(p_user_id uuid, p_delta bigint, p_reason text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_coin bigint;
  v_new bigint;
begin
  select coalesce(coin_balance,0) into v_coin
  from public.user_stats
  where user_id = p_user_id
  for update;

  v_new := greatest(0, v_coin + p_delta);
  update public.user_stats set coin_balance = v_new where user_id = p_user_id;

  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, memo)
  values (p_user_id, 'admin_adjust', p_delta, v_new, 'admin', p_reason);

  return jsonb_build_object('ok', true, 'coin_balance', v_new);
end;
$$;
