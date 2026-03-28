-- Nyang gifting flow + reporter gift history

create table if not exists public.reporter_gift_history (
  id bigserial primary key,
  user_id uuid not null,
  reporter_id text not null,
  item_id text not null references public.shop_items(id),
  quantity int not null default 1,
  nyang_spent bigint not null default 0,
  gifted_at timestamptz not null default now()
);

create index if not exists idx_reporter_gift_history_user on public.reporter_gift_history(user_id, gifted_at desc);
create index if not exists idx_reporter_gift_history_reporter on public.reporter_gift_history(reporter_id, gifted_at desc);

create table if not exists public.reporter_user_affinity (
  user_id uuid not null,
  reporter_id text not null,
  gift_count int not null default 0,
  affinity_points bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, reporter_id)
);

create or replace function public.send_reporter_gift(
  p_user_id uuid,
  p_reporter_id text,
  p_item_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item public.shop_items%rowtype;
  v_owned int;
  v_coin bigint;
  v_new_coin bigint;
  v_cost bigint;
  v_used_owned boolean := false;
  v_aff_add bigint;
begin
  if p_user_id is null or p_reporter_id is null or p_item_id is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id and is_active = true and item_type = 'reporter_item';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_GIFTABLE');
  end if;

  v_cost := coalesce(v_item.coin_price, 0);

  select coalesce(quantity, 0) into v_owned
  from public.owned_items
  where user_id = p_user_id and item_id = p_item_id;

  if v_owned > 0 then
    update public.owned_items
    set quantity = quantity - 1
    where user_id = p_user_id and item_id = p_item_id;

    delete from public.owned_items
    where user_id = p_user_id and item_id = p_item_id and quantity <= 0;

    v_used_owned := true;
    select coalesce(coin_balance,0) into v_new_coin from public.user_stats where user_id = p_user_id;
  else
    select coalesce(coin_balance,0) into v_coin
    from public.user_stats
    where user_id = p_user_id
    for update;

    if v_coin < v_cost then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_cost, 'current', v_coin);
    end if;

    v_new_coin := v_coin - v_cost;
    update public.user_stats set coin_balance = v_new_coin where user_id = p_user_id;

    insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
    values (p_user_id, 'spend', -v_cost, v_new_coin, 'reporter_gift_direct', p_item_id, coalesce(v_item.name,'Reporter gift'));
  end if;

  insert into public.reporter_gift_history(user_id, reporter_id, item_id, quantity, nyang_spent)
  values (p_user_id, p_reporter_id, p_item_id, 1, case when v_used_owned then 0 else v_cost end);

  v_aff_add := greatest(10, v_cost);
  insert into public.reporter_user_affinity(user_id, reporter_id, gift_count, affinity_points)
  values (p_user_id, p_reporter_id, 1, v_aff_add)
  on conflict (user_id, reporter_id)
  do update set
    gift_count = reporter_user_affinity.gift_count + 1,
    affinity_points = reporter_user_affinity.affinity_points + excluded.affinity_points,
    updated_at = now();

  select coalesce(quantity, 0) into v_owned
  from public.owned_items
  where user_id = p_user_id and item_id = p_item_id;

  return jsonb_build_object(
    'ok', true,
    'used_owned', v_used_owned,
    'nyang_balance', v_new_coin,
    'remaining_owned', coalesce(v_owned,0)
  );
end;
$$;
