-- auto-apply
-- My Room: more than one room (owner-approved mockup 2026-10-30).
-- Idempotent: safe to re-run. Runs after 20261030_avatar_catalog.sql
-- (same day, file-name order; needs its avatar_items table) and is the one
-- definition of buy_room_item (room items + character items + room slots)
-- and get_public_room (rooms + character, worn items filtered).
--
-- 1. ROOM SLOTS (room_slots). Everyone has room 1. Extra rooms are slots:
--        slot  Free           Premium
--        2     600 nyang      included
--        3     1,000 nyang    1,000 nyang
--        4     Premium only   1,500 nyang
--        5     Premium only   1,500 nyang
--    So 3 rooms max on Free, 5 on Premium. A bought slot is the id
--    'room_slot_<n>' in user_room_state.owned (server-only list), bought
--    through buy_room_item like every other nyang purchase: it refuses
--    INCLUDED (slot 2 for Premium), PREMIUM_ONLY (slots 4-5 for Free) and
--    SLOT_ORDER (slots are bought in order).
-- 2. ALLOWED ROOMS = 1 + every slot that counts: a Premium-included slot
--    while Premium, a bought slot (Premium-only slots only while Premium).
--    kh_room_allowed(uid) is the one rule; kh_my_room_slots() tells the
--    browser its count, the next slot and its price. If Premium lapses,
--    nothing is deleted: rooms past the allowed count are just hidden
--    (not returned by get_public_room, not shown on My Page) and come back
--    when the learner re-subscribes.
-- 3. DATA (client-writable user_room_state): prefs.rooms = [{ id, name, theme }]
--    in tab order, rooms[0] = the room everyone already had. Placed items
--    stay in the one `layout` array; an entry's `room` field says which
--    room it stands in (no field = rooms[0]), so an item can only stand in
--    one room and every existing layout is room 1 unchanged.
-- 4. get_public_room returns only the allowed rooms (prefs.rooms, themes
--    filtered to owned / free), only layout entries in those rooms, the
--    character only when it stands in one of them, and only owned or free
--    worn items. Still room fields only.

-- ── 1. room_slots ──────────────────────────────────────────────────
create table if not exists public.room_slots (
  slot             smallint primary key check (slot between 2 and 9),
  price_nyang      int not null check (price_nyang >= 0),
  premium_only     boolean not null default false,
  premium_included boolean not null default false
);
alter table public.room_slots enable row level security;
drop policy if exists room_slots_read on public.room_slots;
create policy room_slots_read on public.room_slots for select using (true);
revoke insert, update, delete, truncate, trigger, references on public.room_slots from anon, authenticated;
grant select on public.room_slots to anon, authenticated;

insert into public.room_slots (slot, price_nyang, premium_only, premium_included) values
  (2, 600, false, true), (3, 1000, false, false), (4, 1500, true, false), (5, 1500, true, false)
on conflict (slot) do update
  set price_nyang = excluded.price_nyang, premium_only = excluded.premium_only,
      premium_included = excluded.premium_included;

-- ── 2. allowed rooms ───────────────────────────────────────────────
create or replace function public.kh_room_is_premium(p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v boolean := false;
begin
  if p_uid is null then return false; end if;
  if to_regprocedure('public.kh_is_premium(uuid)') is not null then
    execute 'select coalesce(public.kh_is_premium($1), false)' into v using p_uid;
  end if;
  return coalesce(v, false);
end;
$function$;
revoke execute on function public.kh_room_is_premium(uuid) from public, anon, authenticated;
grant execute on function public.kh_room_is_premium(uuid) to service_role;

create or replace function public.kh_room_allowed(p_uid uuid)
returns int
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_prem  boolean := public.kh_room_is_premium(p_uid);
  v_owned jsonb;
  v_n     int := 1;
  s       record;
begin
  select coalesce(owned, '[]'::jsonb) into v_owned from public.user_room_state where user_id = p_uid;
  v_owned := coalesce(v_owned, '[]'::jsonb);
  for s in select * from public.room_slots order by slot loop
    if s.premium_only and not v_prem then continue; end if;
    if (s.premium_included and v_prem) or v_owned ? ('room_slot_' || s.slot) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$function$;
revoke execute on function public.kh_room_allowed(uuid) from public, anon, authenticated;
grant execute on function public.kh_room_allowed(uuid) to service_role;

-- The caller's rooms: allowed count, plan max, and the next slot to add.
create or replace function public.kh_my_room_slots()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_prem  boolean;
  v_owned jsonb;
  v_list  jsonb := '[]'::jsonb;
  v_next  jsonb := null;
  v_max   int := 1;
  v_has   boolean;
  s       record;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); end if;
  v_prem := public.kh_room_is_premium(v_uid);
  select coalesce(owned, '[]'::jsonb) into v_owned from public.user_room_state where user_id = v_uid;
  v_owned := coalesce(v_owned, '[]'::jsonb);
  for s in select * from public.room_slots order by slot loop
    v_has := (s.premium_included and v_prem) or (v_owned ? ('room_slot_' || s.slot) and (v_prem or not s.premium_only));
    if v_prem or not s.premium_only then v_max := v_max + 1; end if;
    v_list := v_list || jsonb_build_array(jsonb_build_object(
      'slot', s.slot, 'price', s.price_nyang, 'premium_only', s.premium_only,
      'premium_included', s.premium_included, 'bought', v_owned ? ('room_slot_' || s.slot), 'counts', v_has));
    if v_next is null and not v_has then
      v_next := jsonb_build_object('slot', s.slot, 'price', case when s.premium_included and v_prem then 0 else s.price_nyang end,
                                   'premium_only', s.premium_only, 'locked', s.premium_only and not v_prem);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'premium', v_prem, 'allowed', public.kh_room_allowed(v_uid),
                            'max', v_max, 'next', v_next, 'slots', v_list);
end;
$function$;
revoke execute on function public.kh_my_room_slots() from public, anon;
grant execute on function public.kh_my_room_slots() to authenticated, service_role;

-- ── buy_room_item: + room slots ────────────────────────────────────
-- Room items (room_unlocks → UNLOCK_ONLY), character items from avatar_items
-- (UNLOCK_ONLY for study goals, OUT_OF_SEASON outside sale_months) and room
-- slots (INCLUDED / PREMIUM_ONLY / SLOT_ORDER). Never trusts a client price.
create or replace function public.buy_room_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id   uuid   := auth.uid();
  v_item      public.room_items%rowtype;
  v_av        public.avatar_items%rowtype;
  v_slot      public.room_slots%rowtype;
  v_kind      text := 'room';
  v_price     int;
  v_coin      bigint;
  v_new_coin  bigint;
  v_owned     jsonb;
  v_name      text;
  v_prem      boolean;
  v_month     int := extract(month from (now() at time zone 'Asia/Seoul'))::int;
  s           record;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;
  if p_item_id is null or length(p_item_id) = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  if p_item_id ~ '^room_slot_[0-9]{1,2}$' then
    select * into v_slot from public.room_slots where slot = substring(p_item_id from 11)::int;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND');
    end if;
    v_kind := 'slot';
    v_price := v_slot.price_nyang;
    v_name := 'Room ' || v_slot.slot;
  else
    select * into v_item from public.room_items where id = p_item_id and active = true;
    if found then
      v_price := coalesce(v_item.price_nyang, 0);
      v_name  := coalesce(v_item.name, p_item_id);
    else
      select * into v_av from public.avatar_items where id = p_item_id and active = true;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND');
      end if;
      v_kind := 'avatar';
      v_price := coalesce(v_av.price_nyang, 0);
      v_name  := coalesce(v_av.name, p_item_id);
    end if;
  end if;

  insert into public.user_room_state (user_id) values (v_user_id) on conflict (user_id) do nothing;

  select owned into v_owned from public.user_room_state where user_id = v_user_id for update;
  v_owned := coalesce(v_owned, '[]'::jsonb);
  if v_owned ? p_item_id then
    select coalesce(coin_balance, 0) into v_new_coin from public.user_stats where user_id = v_user_id;
    return jsonb_build_object('ok', true, 'already_owned', true, 'nyang_balance', v_new_coin);
  end if;

  if v_kind = 'slot' then
    v_prem := public.kh_room_is_premium(v_user_id);
    if v_slot.premium_included and v_prem then
      return jsonb_build_object('ok', false, 'error', 'INCLUDED');
    end if;
    if v_slot.premium_only and not v_prem then
      return jsonb_build_object('ok', false, 'error', 'PREMIUM_ONLY');
    end if;
    -- Slots are added in order: every lower slot must already count.
    for s in select * from public.room_slots where slot < v_slot.slot order by slot loop
      if not ((s.premium_included and v_prem) or (v_owned ? ('room_slot_' || s.slot) and (v_prem or not s.premium_only))) then
        return jsonb_build_object('ok', false, 'error', 'SLOT_ORDER', 'slot', s.slot);
      end if;
    end loop;
  end if;

  if (v_kind = 'room' and exists (select 1 from public.room_unlocks where item_id = p_item_id and active = true))
     or (v_kind = 'avatar' and v_av.unlock_goal_key is not null) then
    return jsonb_build_object('ok', false, 'error', 'UNLOCK_ONLY');
  end if;

  if v_kind = 'avatar' and v_av.sale_months is not null and cardinality(v_av.sale_months) > 0
     and not (v_month = any (v_av.sale_months)) then
    return jsonb_build_object('ok', false, 'error', 'OUT_OF_SEASON', 'months', to_jsonb(v_av.sale_months));
  end if;

  select coalesce(coin_balance, 0) into v_coin from public.user_stats where user_id = v_user_id for update;
  v_coin := coalesce(v_coin, 0);
  if v_coin < v_price then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_price, 'current', v_coin);
  end if;

  v_new_coin := v_coin - v_price;
  update public.user_stats set coin_balance = v_new_coin where user_id = v_user_id;

  update public.user_room_state
     set owned = coalesce(owned, '[]'::jsonb) || jsonb_build_array(p_item_id), updated_at = now()
   where user_id = v_user_id;

  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  values (v_user_id, 'spend', -v_price, v_new_coin,
          case v_kind when 'avatar' then 'avatar_item' when 'slot' then 'room_slot' else 'room_item' end, p_item_id,
          case v_kind when 'avatar' then 'Character item: ' when 'slot' then 'Extra room: ' else 'Room item: ' end || v_name);

  return jsonb_build_object('ok', true, 'already_owned', false, 'price', v_price, 'nyang_balance', v_new_coin);
end;
$function$;
revoke execute on function public.buy_room_item(text) from public, anon;
grant execute on function public.buy_room_item(text) to authenticated, service_role;

-- ── 4. get_public_room: allowed rooms only ─────────────────────────
-- Owned-or-free check for a worn piece (avatar_items id).
create or replace function public.kh_avatar_item_ok(p_owned jsonb, p_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.avatar_items a
                  where a.id = p_id and a.active
                    and ((a.price_nyang = 0 and a.unlock_goal_key is null) or coalesce(p_owned, '[]'::jsonb) ? p_id));
$function$;
revoke execute on function public.kh_avatar_item_ok(jsonb, text) from public, anon, authenticated;
grant execute on function public.kh_avatar_item_ok(jsonb, text) to service_role;

create or replace function public.get_public_room(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_layout  jsonb;
  v_owned   jsonb;
  v_prefs   jsonb;
  v_viewer  uuid := auth.uid();
  v_av      jsonb;
  v_hair    text;
  v_outfit  text;
  v_acc     jsonb := '[]'::jsonb;
  v_avatar  jsonb := null;
  v_allowed int;
  v_rooms   jsonb := '[]'::jsonb;
  v_ids     text[] := array[]::text[];
  v_main    text;
  r         record;
  v_id      text;
  v_theme   text;
begin
  if p_user is null then return null; end if;
  if v_viewer is not null and v_viewer <> p_user and to_regprocedure('public.is_blocked(uuid,uuid)') is not null then
    if public.is_blocked(v_viewer, p_user) then return null; end if;
  end if;

  select coalesce(s.layout, '[]'::jsonb), coalesce(s.owned, '[]'::jsonb), coalesce(s.prefs, '{}'::jsonb)
    into v_layout, v_owned, v_prefs
    from public.user_room_state s where s.user_id = p_user;
  if not found then return null; end if;
  if jsonb_typeof(v_prefs) <> 'object' then v_prefs := '{}'::jsonb; end if;
  if jsonb_typeof(v_layout) <> 'array' then v_layout := '[]'::jsonb; end if;

  -- Character: only free or owned pieces; anything else falls back.
  v_av := v_prefs -> 'avatar';
  if jsonb_typeof(v_av) = 'object' then
    v_hair := v_av ->> 'hair';
    if v_hair is null or v_hair not in ('long', 'short', 'bob', 'curly') then v_hair := 'long'; end if;
    v_outfit := v_av ->> 'outfit';
    if v_outfit is null or not public.kh_avatar_item_ok(v_owned, 'av_outfit_' || v_outfit) then v_outfit := 'tee'; end if;
    if jsonb_typeof(v_av -> 'acc') = 'array' then
      select coalesce(jsonb_agg(to_jsonb(x.v) order by x.n), '[]'::jsonb) into v_acc from (
        select distinct on (e.v) e.v, e.n
          from jsonb_array_elements_text(v_av -> 'acc') with ordinality as e(v, n)
         where public.kh_avatar_item_ok(v_owned, 'av_acc_' || e.v)
         order by e.v, e.n
         limit 6
      ) x;
    end if;
    v_avatar := jsonb_build_object('hair', v_hair, 'outfit', v_outfit, 'acc', v_acc,
                                   'profile', coalesce(case when jsonb_typeof(v_av -> 'profile') = 'boolean'
                                                            then (v_av ->> 'profile')::boolean end, false));
  end if;

  -- Rooms: the first `allowed` valid entries of prefs.rooms (room 1 always).
  v_allowed := public.kh_room_allowed(p_user);
  if jsonb_typeof(v_prefs -> 'rooms') = 'array' then
    for r in select e, n from jsonb_array_elements(v_prefs -> 'rooms') with ordinality as t(e, n) order by n loop
      exit when jsonb_array_length(v_rooms) >= v_allowed;
      continue when jsonb_typeof(r.e) <> 'object';
      v_id := left(coalesce(nullif(r.e ->> 'id', ''), case when r.n = 1 then 'main' end), 40);
      continue when v_id is null or v_id = any (v_ids);
      v_theme := r.e ->> 'theme';
      if v_theme is null or (v_theme <> 'classic' and not public.kh_avatar_item_ok(v_owned, 'av_room_' || v_theme)) then
        v_theme := 'classic';
      end if;
      v_ids := v_ids || v_id;
      v_rooms := v_rooms || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'name', left(coalesce(nullif(r.e ->> 'name', ''), 'Room ' || r.n), 40), 'theme', v_theme));
    end loop;
  end if;
  if jsonb_array_length(v_rooms) = 0 then
    v_rooms := jsonb_build_array(jsonb_build_object('id', 'main', 'name', 'My Room', 'theme', 'classic'));
    v_ids := array['main'];
  end if;
  v_main := v_ids[1];

  -- Placed items: owned (or free), standing in an allowed room (no / unknown
  -- room = room 1, unless it names a room that is hidden), plus the
  -- character once; at most 200.
  select coalesce(jsonb_agg(x.e order by x.n), '[]'::jsonb) into v_layout from (
    select t.e, t.n from jsonb_array_elements(v_layout) with ordinality as t(e, n)
     where jsonb_typeof(t.e) = 'object'
       and (coalesce(t.e ->> 'room', v_main) = any (v_ids)
            or not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_prefs -> 'rooms') = 'array' then v_prefs -> 'rooms' else '[]'::jsonb end) rr
                            where rr ->> 'id' = t.e ->> 'room'))
       and (v_owned ? (t.e ->> 'id')
            or exists (select 1 from public.room_items ri where ri.id = t.e ->> 'id' and coalesce(ri.price_nyang, 0) = 0)
            or (t.e ->> 'id' = 'kh_avatar' and v_avatar is not null
                and t.n = (select min(t2.n) from jsonb_array_elements(v_layout) with ordinality as t2(e2, n)
                            where t2.e2 ->> 'id' = 'kh_avatar')))
     order by t.n
     limit 200
  ) x;
  -- Entries in an unknown room are shown in room 1.
  select coalesce(jsonb_agg(case when coalesce(e ->> 'room', v_main) = any (v_ids) then e else e - 'room' end), '[]'::jsonb)
    into v_layout from jsonb_array_elements(v_layout) e;

  return jsonb_build_object(
    'layout', v_layout,
    'owned',  v_owned,
    'prefs',  jsonb_build_object(
                'theme', jsonb_build_object(
                  'wallpaper', coalesce(v_prefs #>> '{theme,wallpaper}', 'default'),
                  'floor',     coalesce(v_prefs #>> '{theme,floor}', 'none')),
                'rooms', v_rooms,
                'room_theme', v_rooms -> 0 ->> 'theme',
                'avatar', v_avatar));
end;
$function$;
revoke execute on function public.get_public_room(uuid) from public;
grant execute on function public.get_public_room(uuid) to anon, authenticated, service_role;
