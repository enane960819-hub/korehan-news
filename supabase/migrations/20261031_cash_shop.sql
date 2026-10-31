-- auto-apply
-- Special shop (owner-approved mockup 2026-10-31): digital items bought with a
-- card — season packs, a one-time starter pack, premium outfits, reporter
-- photocard sets. Real goods are "Coming soon" (goods_interest counts who
-- wants which reporter first).
--
-- Flow: billing 'item_checkout' creates a pending cash_orders row and a Stripe
-- Checkout session (mode payment) → billing-webhook re-reads the session and,
-- when paid, calls kh_grant_cash_order() → items go into user_room_state.owned
-- (room / avatar ids) or user_photocards ('pc_*' ids). A full refund calls
-- kh_revoke_cash_order(), which takes back only what that order added.
-- Nothing here is writable from the browser: products are admin-write, orders
-- and photocards are written by the definer functions / service_role only.
--
-- Cash-only art can't be bought with nyang: room_items / avatar_items get
-- cash_only (buy_room_item refuses it, 20261030_room_slots.sql).
-- Idempotent: safe to re-run.

-- ── 1. cash-only flag on the catalogues ─────────────────────────────
alter table public.room_items   add column if not exists cash_only boolean not null default false;
alter table public.avatar_items add column if not exists cash_only boolean not null default false;

-- ── 2. products ─────────────────────────────────────────────────────
create table if not exists public.cash_products (
  id                   text primary key check (id ~ '^[a-z0-9_]{3,60}$'),
  kind                 text not null check (kind in ('pack', 'starter', 'outfit', 'photocard_set')),
  name                 text not null,
  description          text,
  price_cents          int  not null check (price_cents between 50 and 100000),
  premium_discount_pct int  not null default 20 check (premium_discount_pct between 0 and 90),
  items                text[] not null default '{}',
  -- What the shop shows: [{ "label": "Santa outfit", "img": "assets/..." }, ...]
  preview              jsonb not null default '[]'::jsonb,
  image_url            text,
  reporter_id          text,
  badge                text,
  one_per_account      boolean not null default false,
  starts_at            timestamptz,
  ends_at              timestamptz,
  sort                 int not null default 100,
  active               boolean not null default false,
  created_at           timestamptz not null default now()
);
alter table public.cash_products enable row level security;
drop policy if exists cash_products_read on public.cash_products;
create policy cash_products_read on public.cash_products for select
  using (active or coalesce(public.is_admin_email(), false));
drop policy if exists cash_products_admin on public.cash_products;
create policy cash_products_admin on public.cash_products for all
  using (coalesce(public.is_admin_email(), false)) with check (coalesce(public.is_admin_email(), false));
revoke all on public.cash_products from anon;
grant select on public.cash_products to anon, authenticated;
grant insert, update, delete on public.cash_products to authenticated;   -- admin only, by policy

-- ── 3. orders ───────────────────────────────────────────────────────
create table if not exists public.cash_orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  product_id            text not null references public.cash_products(id),
  items                 text[] not null default '{}',     -- snapshot at checkout
  amount_cents          int  not null,
  currency              text not null default 'usd',
  status                text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'canceled')),
  stripe_session_id     text unique,
  stripe_payment_intent text,
  granted               text[] not null default '{}',     -- what this order actually added
  created_at            timestamptz not null default now(),
  paid_at               timestamptz,
  refunded_at           timestamptz
);
create index if not exists cash_orders_user_idx on public.cash_orders (user_id, created_at desc);
create index if not exists cash_orders_pi_idx on public.cash_orders (stripe_payment_intent);
alter table public.cash_orders enable row level security;
drop policy if exists cash_orders_read on public.cash_orders;
create policy cash_orders_read on public.cash_orders for select
  using (user_id = auth.uid() or coalesce(public.is_admin_email(), false));
revoke all on public.cash_orders from anon, authenticated;
grant select on public.cash_orders to authenticated;

-- ── 4. digital photocards ───────────────────────────────────────────
create table if not exists public.user_photocards (
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     text not null,
  product_id  text,
  acquired_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.user_photocards enable row level security;
drop policy if exists user_photocards_read on public.user_photocards;
create policy user_photocards_read on public.user_photocards for select
  using (user_id = auth.uid() or coalesce(public.is_admin_email(), false));
revoke all on public.user_photocards from anon, authenticated;
grant select on public.user_photocards to authenticated;

-- ── 5. "Notify me" for real goods ───────────────────────────────────
create table if not exists public.goods_interest (
  user_id     uuid not null references auth.users(id) on delete cascade,
  reporter_id text not null check (reporter_id ~ '^cr[0-9]{1,3}$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, reporter_id)
);
alter table public.goods_interest enable row level security;
drop policy if exists goods_interest_own on public.goods_interest;
create policy goods_interest_own on public.goods_interest for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists goods_interest_admin on public.goods_interest;
create policy goods_interest_admin on public.goods_interest for select
  using (coalesce(public.is_admin_email(), false));
revoke all on public.goods_interest from anon;
grant select, insert, delete on public.goods_interest to authenticated;

-- ── 6. grant / revoke (service_role only — called by billing-webhook) ──
create or replace function public.kh_grant_cash_order(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o       public.cash_orders%rowtype;
  v_owned jsonb;
  v_added text[] := '{}';
  v_id    text;
  v_n     int;
begin
  select * into o from public.cash_orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_ORDER'); end if;
  if o.status = 'paid' then return jsonb_build_object('ok', true, 'already', true, 'granted', to_jsonb(o.granted)); end if;
  if o.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'BAD_STATUS', 'status', o.status); end if;

  insert into public.user_room_state (user_id) values (o.user_id) on conflict (user_id) do nothing;
  select coalesce(owned, '[]'::jsonb) into v_owned from public.user_room_state where user_id = o.user_id for update;

  foreach v_id in array o.items loop
    if v_id like 'pc\_%' then
      insert into public.user_photocards (user_id, card_id, product_id) values (o.user_id, v_id, o.product_id)
      on conflict do nothing;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_added := v_added || v_id; end if;
    elsif not (v_owned ? v_id) then
      v_owned := v_owned || jsonb_build_array(v_id);
      v_added := v_added || v_id;
    end if;
  end loop;

  update public.user_room_state set owned = v_owned, updated_at = now() where user_id = o.user_id;
  update public.cash_orders set status = 'paid', paid_at = now(), granted = v_added where id = o.id;
  return jsonb_build_object('ok', true, 'granted', to_jsonb(v_added));
end;
$function$;

create or replace function public.kh_revoke_cash_order(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o public.cash_orders%rowtype;
begin
  select * into o from public.cash_orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_ORDER'); end if;
  if o.status <> 'paid' then return jsonb_build_object('ok', true, 'skipped', o.status); end if;

  -- Take back only what this order added (items owned before stay).
  update public.user_room_state u
     set owned = coalesce((select jsonb_agg(e) from jsonb_array_elements(u.owned) e
                            where not ((e #>> '{}') = any (o.granted))), '[]'::jsonb),
         updated_at = now()
   where u.user_id = o.user_id;
  delete from public.user_photocards where user_id = o.user_id and card_id = any (o.granted) and product_id = o.product_id;
  update public.cash_orders set status = 'refunded', refunded_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'revoked', to_jsonb(o.granted));
end;
$function$;

revoke execute on function public.kh_grant_cash_order(uuid)  from public, anon, authenticated;
revoke execute on function public.kh_revoke_cash_order(uuid) from public, anon, authenticated;
grant  execute on function public.kh_grant_cash_order(uuid)  to service_role;
grant  execute on function public.kh_revoke_cash_order(uuid) to service_role;
