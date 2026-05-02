-- Gacha (random draw) system — separate item pool that lives outside the
-- regular shop. Users spend nyang (user_stats.coin_balance) on draws and
-- get a weighted-random item back. Already-owned items convert into a
-- nyang refund (the "dupe" branch) so the experience scales for big
-- spenders without becoming pay-to-collect.
--
-- Three tables:
--   gacha_items        — the catalog (rarity + weight + image)
--   gacha_owned_items  — what each user has pulled
--   gacha_draws        — every draw (audit log; also drives "history" UI)
--
-- One RPC: draw_gacha(user, count) — atomic balance check, weighted
-- pick, dupe handling, ownership write. The client never picks the
-- result; that's the anti-cheat boundary.

create table if not exists public.gacha_items (
  id           text primary key,
  name         text not null,
  description  text,
  image_url    text,
  rarity       text not null check (rarity in ('C','R','SR','SSR')),
  weight       int  not null default 1,         -- relative draw weight
  dupe_refund  int  not null default 30,        -- nyang refunded if user already owns it
  is_active    boolean not null default true,
  sort_order   int  not null default 100,
  created_at   timestamptz not null default now()
);

create index if not exists gacha_items_active_idx
  on public.gacha_items (is_active, rarity, sort_order);

create table if not exists public.gacha_owned_items (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.gacha_items(id) on delete cascade,
  quantity    int  not null default 1,          -- duplicates increment instead of erroring
  acquired_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists gacha_owned_user_idx
  on public.gacha_owned_items (user_id);

create table if not exists public.gacha_draws (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,                   -- denormalized: item may be deleted later
  rarity       text,
  was_dupe     boolean not null default false,
  cost_paid    int    not null default 0,
  refund       int    not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists gacha_draws_user_idx
  on public.gacha_draws (user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.gacha_items       enable row level security;
alter table public.gacha_owned_items enable row level security;
alter table public.gacha_draws       enable row level security;

drop policy if exists "gacha_items_public_read" on public.gacha_items;
create policy "gacha_items_public_read"
  on public.gacha_items for select
  using (is_active = true);

drop policy if exists "gacha_items_admin_write" on public.gacha_items;
create policy "gacha_items_admin_write"
  on public.gacha_items for all
  using (
    exists (
      select 1 from app_settings
      where key = 'admin_user_ids'
        and value::jsonb ? auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from app_settings
      where key = 'admin_user_ids'
        and value::jsonb ? auth.uid()::text
    )
  );

drop policy if exists "gacha_owned_self_read" on public.gacha_owned_items;
create policy "gacha_owned_self_read"
  on public.gacha_owned_items for select
  using (auth.uid() = user_id);

drop policy if exists "gacha_draws_self_read" on public.gacha_draws;
create policy "gacha_draws_self_read"
  on public.gacha_draws for select
  using (auth.uid() = user_id);

-- ── RPC: draw_gacha ───────────────────────────────────────────
-- p_count must be 1 or 5. Cost is calculated server-side from app_settings
-- so an admin can change pricing without a code deploy.

create or replace function public.draw_gacha(p_user_id uuid, p_count int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_cost_single  int := 100;
  v_cost_five    int := 450;
  v_total_cost   int;
  v_balance      bigint;
  v_setting      jsonb;
  v_total_weight bigint;
  v_pick         bigint;
  v_running      bigint;
  v_item         public.gacha_items%rowtype;
  v_owned        int;
  v_results      jsonb := '[]'::jsonb;
  v_total_refund int := 0;
  v_i            int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'NO_USER');
  end if;
  if p_count is null or (p_count <> 1 and p_count <> 5) then
    return jsonb_build_object('ok', false, 'error', 'BAD_COUNT');
  end if;

  -- Optional pricing override in app_settings.gacha_pricing
  -- (jsonb: {"single": 100, "five": 450})
  select value::jsonb into v_setting from public.app_settings where key = 'gacha_pricing';
  if v_setting is not null then
    v_cost_single := coalesce((v_setting->>'single')::int, v_cost_single);
    v_cost_five   := coalesce((v_setting->>'five')::int,   v_cost_five);
  end if;

  v_total_cost := case when p_count = 1 then v_cost_single else v_cost_five end;

  select coalesce(coin_balance, 0) into v_balance
    from public.user_stats where user_id = p_user_id for update;

  if v_balance < v_total_cost then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_COIN', 'have', v_balance, 'need', v_total_cost);
  end if;

  -- Sum weights for active items.
  select coalesce(sum(weight), 0) into v_total_weight
    from public.gacha_items where is_active = true and weight > 0;
  if v_total_weight = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_POOL');
  end if;

  -- Charge the user upfront.
  update public.user_stats
    set coin_balance = coin_balance - v_total_cost
    where user_id = p_user_id;

  -- Roll p_count items.
  for v_i in 1..p_count loop
    v_pick := 1 + floor(random() * v_total_weight)::bigint;
    v_running := 0;
    v_item := null;
    -- Walk the items in deterministic order so weights line up with v_pick.
    for v_item in
      select * from public.gacha_items
      where is_active = true and weight > 0
      order by id
    loop
      v_running := v_running + v_item.weight;
      if v_pick <= v_running then exit; end if;
    end loop;

    -- Dupe handling: refund partial nyang instead of stacking inventory
    -- forever.
    select quantity into v_owned
      from public.gacha_owned_items
      where user_id = p_user_id and item_id = v_item.id;

    if coalesce(v_owned, 0) > 0 then
      v_total_refund := v_total_refund + coalesce(v_item.dupe_refund, 30);
      insert into public.gacha_owned_items(user_id, item_id, quantity)
      values (p_user_id, v_item.id, 1)
      on conflict (user_id, item_id)
      do update set quantity = public.gacha_owned_items.quantity + 1;

      insert into public.gacha_draws(user_id, item_id, rarity, was_dupe, cost_paid, refund)
      values (p_user_id, v_item.id, v_item.rarity, true,
              case when v_i = 1 then v_total_cost else 0 end,
              coalesce(v_item.dupe_refund, 30));

      v_results := v_results || jsonb_build_object(
        'item_id',     v_item.id,
        'name',        v_item.name,
        'description', v_item.description,
        'image_url',   v_item.image_url,
        'rarity',      v_item.rarity,
        'is_dupe',     true,
        'refund',      coalesce(v_item.dupe_refund, 30)
      );
    else
      insert into public.gacha_owned_items(user_id, item_id, quantity)
      values (p_user_id, v_item.id, 1);

      insert into public.gacha_draws(user_id, item_id, rarity, was_dupe, cost_paid, refund)
      values (p_user_id, v_item.id, v_item.rarity, false,
              case when v_i = 1 then v_total_cost else 0 end, 0);

      v_results := v_results || jsonb_build_object(
        'item_id',     v_item.id,
        'name',        v_item.name,
        'description', v_item.description,
        'image_url',   v_item.image_url,
        'rarity',      v_item.rarity,
        'is_dupe',     false,
        'refund',      0
      );
    end if;
  end loop;

  -- Apply refunds in one update.
  if v_total_refund > 0 then
    update public.user_stats
      set coin_balance = coin_balance + v_total_refund
      where user_id = p_user_id;
  end if;

  -- Final balance for the client.
  select coalesce(coin_balance, 0) into v_balance
    from public.user_stats where user_id = p_user_id;

  return jsonb_build_object(
    'ok',           true,
    'cost_paid',    v_total_cost,
    'refund_total', v_total_refund,
    'balance',      v_balance,
    'items',        v_results
  );
end;
$$;

grant execute on function public.draw_gacha(uuid, int) to authenticated;
