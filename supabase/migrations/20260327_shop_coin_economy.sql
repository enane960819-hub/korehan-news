-- Coin economy + shop system (XP remains non-spendable progression stat)

alter table public.user_stats
  add column if not exists coin_balance bigint not null default 0;

create table if not exists public.coin_transactions (
  id bigserial primary key,
  user_id uuid not null,
  tx_type text not null check (tx_type in ('earn','spend','admin_adjust')),
  amount bigint not null,
  balance_after bigint,
  source text,
  reference_id text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  slug text unique,
  description text,
  image_url text,
  item_type text not null default 'one_time_unlock',
  coin_price bigint,
  cash_price numeric(10,2),
  is_active boolean not null default true,
  can_buy_with_coin boolean not null default true,
  can_buy_with_cash boolean not null default false,
  is_repeatable boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_purchases (
  id bigserial primary key,
  user_id uuid not null,
  item_id text not null references public.shop_items(id),
  purchase_type text not null check (purchase_type in ('coin','cash')),
  coin_spent bigint not null default 0,
  cash_amount numeric(10,2),
  payment_status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.owned_items (
  id bigserial primary key,
  user_id uuid not null,
  item_id text not null references public.shop_items(id),
  quantity int not null default 1,
  acquired_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.payment_orders (
  id bigserial primary key,
  user_id uuid not null,
  item_id text not null references public.shop_items(id),
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending',
  provider text,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

  select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id;
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

create or replace function public.admin_adjust_coin(p_user_id uuid, p_delta bigint, p_reason text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_coin bigint;
  v_new bigint;
begin
  select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id;
  v_new := greatest(0, v_coin + p_delta);
  update public.user_stats set coin_balance = v_new where user_id = p_user_id;

  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, memo)
  values (p_user_id, 'admin_adjust', p_delta, v_new, 'admin', p_reason);

  return jsonb_build_object('ok', true, 'coin_balance', v_new);
end;
$$;

insert into public.shop_items (
  id, name, slug, description, image_url, item_type,
  coin_price, cash_price, is_active, can_buy_with_coin, can_buy_with_cash, is_repeatable, sort_order
) values
  ('badge_founder', 'Founder Badge', 'founder-badge', 'Display an exclusive Founder profile badge.', 'https://picsum.photos/seed/shop-founder-badge/640/360', 'profile_badge', 120, 0, true, true, false, false, 10),
  ('cosmetic_neon_frame', 'Neon Profile Frame', 'neon-profile-frame', 'Cosmetic frame for your profile image.', 'https://picsum.photos/seed/shop-neon-frame/640/360', 'profile_cosmetic', 180, 0, true, true, false, false, 20),
  ('reporter_coffee', 'Reporter Coffee Treat', 'reporter-coffee-treat', 'Give your favorite reporter a coffee boost.', 'https://picsum.photos/seed/shop-reporter-coffee/640/360', 'reporter_item', 60, 0, true, true, false, true, 30),
  ('reporter_bubble_tea', 'Reporter Bubble Tea', 'reporter-bubble-tea', 'A sweet bubble tea gift for your favorite reporter.', 'https://picsum.photos/seed/shop-reporter-bubble-tea/640/360', 'reporter_item', 75, 0, true, true, false, true, 40),
  ('reporter_flower', 'Reporter Flower Bouquet', 'reporter-flower-bouquet', 'A bouquet gift for reporter affinity moments.', 'https://picsum.photos/seed/shop-reporter-flower/640/360', 'reporter_item', 95, 0, true, true, false, true, 50)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  image_url = excluded.image_url,
  item_type = excluded.item_type,
  coin_price = excluded.coin_price,
  cash_price = excluded.cash_price,
  is_active = excluded.is_active,
  can_buy_with_coin = excluded.can_buy_with_coin,
  can_buy_with_cash = excluded.can_buy_with_cash,
  is_repeatable = excluded.is_repeatable,
  sort_order = excluded.sort_order,
  updated_at = now();
