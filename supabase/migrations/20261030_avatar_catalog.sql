-- auto-apply
-- My Room: character editor + room themes (owner-approved mockup 2026-10-30).
-- Idempotent: safe to re-run.
--
-- 1. CATALOGUE (avatar_items)
--    Outfits, accessories and room theme pictures the character editor
--    (korehan/js/features/avatar-editor.js) can sell. A table of its own so
--    the furniture shops (My Room, korehan-shop.html, room-view.js) that list
--    every active room_items row never show clothes as furniture.
--    Ids are namespaced so they can share user_room_state.owned with room
--    items: av_outfit_<id>, av_acc_<id>, av_room_<id>.
--      * price_nyang 0 and no unlock goal = free for everyone (never needs
--        an owned entry);
--      * unlock_goal_key set = earned by studying, never sold (buy_room_item
--        answers UNLOCK_ONLY); goals use the same keys/progress as
--        room_unlocks (kh_room_unlock_progress);
--      * sale_months set = only on sale in those KST months (buy_room_item
--        answers OUT_OF_SEASON otherwise); an owner keeps it all year.
--    Hair styles (long, short, bob, curly) are all free and not listed;
--    the basic tee is the bare body sprite (av_outfit_tee, free).
--    Prices (owner delegated, 2026-10-30): outfits 300–400, accessories
--    120–220, rooms 800–1,200; regular study earns about 50 nyang a day
--    (see 20261029_my_room_ownership_prices.sql).
--    Public read, service_role write (prices change through a migration or
--    the SQL editor). A re-run refreshes name / price / season / goal / sort
--    but keeps an admin's `active` choice.
--
-- 2. BUYING: buy_room_item stays the only purchase path and the only
--    nyang-spending writer of user_room_state.owned. It now also finds ids
--    in avatar_items, refuses unlock-only items (UNLOCK_ONLY) and items out
--    of their sale window (OUT_OF_SEASON), and logs source 'avatar_item'.
--
-- 3. UNLOCKS: kh_claim_room_unlocks also grants avatar items whose study
--    goal is reached (hanbok: 7-day streak, barista: 100 saved words, heart
--    glasses: one TOPIK practice test, starry attic: 30-day streak). They are
--    returned separately (avatar_unlocks / avatar_new_items) so the room's
--    "Next unlocks" list and its "Place it now" toast stay furniture-only.
--    Streak now has one source everywhere: kh_user_streak (20261030_kh_user_streak.sql),
--    the same number Home and My Page show (the coin-ledger walk is kept
--    only as a fallback while that function doesn't exist).
--
-- 4. WHAT THE LEARNER WEARS lives in the client-writable user_room_state.prefs:
--      prefs.avatar = { hair, outfit, acc: [ids], profile: bool }
--      prefs.rooms  = [{ id, name, theme }]  — one entry per room; rooms[0]
--                     is today's single room and its layout stays in the
--                     `layout` column (a later multi-room feature keeps
--                     each further room's layout in its entry).
--    The character stands in the room as layout entry { id: 'kh_avatar', x, y, scale, flipped }.
--    get_public_room now also returns prefs.avatar and prefs.room_theme,
--    filtered on the server: an item the owner doesn't own (and that isn't
--    free) is dropped, so editing prefs from the console can't show unowned
--    clothes or rooms to friends. Still room fields only.

-- ── 1. avatar_items ────────────────────────────────────────────────
create table if not exists public.avatar_items (
  id                 text primary key,
  kind               text not null check (kind in ('outfit', 'accessory', 'room_theme')),
  name               text not null,
  price_nyang        int  not null default 0 check (price_nyang >= 0),
  sale_months        smallint[],
  unlock_goal_key    text check (unlock_goal_key in ('streak_days', 'saved_words', 'articles_read', 'topik_tests', 'games_played')),
  unlock_goal_target int  check (unlock_goal_target is null or unlock_goal_target > 0),
  unlock_label       text,
  sort               int  not null default 100,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint avatar_items_goal_pair check ((unlock_goal_key is null) = (unlock_goal_target is null))
);

alter table public.avatar_items enable row level security;
drop policy if exists avatar_items_read on public.avatar_items;
create policy avatar_items_read on public.avatar_items for select using (true);
revoke insert, update, delete, truncate, trigger, references on public.avatar_items from anon, authenticated;
grant select on public.avatar_items to anon, authenticated;

insert into public.avatar_items (id, kind, name, price_nyang, sale_months, unlock_goal_key, unlock_goal_target, unlock_label, sort)
select v.id, v.kind, v.name, v.price, v.months, v.goal_key, v.goal_target, v.label, v.sort
  from (values
    -- outfits
    ('av_outfit_tee',       'outfit',     'Basic tee',      0,    null::smallint[], null, null::int, null, 10),
    ('av_outfit_uniform',   'outfit',     'School uniform', 0,    null, null, null, null, 20),
    ('av_outfit_knit',      'outfit',     'Knit',           300,  null, null, null, null, 30),
    ('av_outfit_street',    'outfit',     'Street',         300,  null, null, null, null, 40),
    ('av_outfit_summer',    'outfit',     'Summer',         300,  null, null, null, null, 50),
    ('av_outfit_cute',      'outfit',     'Cute',           400,  null, null, null, null, 60),
    ('av_outfit_pajamas',   'outfit',     'Pajamas',        400,  null, null, null, null, 70),
    ('av_outfit_hanbok',    'outfit',     'Hanbok',         0,    null, 'streak_days', 7,   'Study 7 days in a row', 80),
    ('av_outfit_barista',   'outfit',     'Barista',        0,    null, 'saved_words', 100, 'Save 100 words', 90),
    ('av_outfit_halloween', 'outfit',     'Halloween',      350,  array[10]::smallint[], null, null, null, 100),
    -- accessories
    ('av_acc_headband',      'accessory', 'Bow headband',   0,    null, null, null, null, 210),
    ('av_acc_black-bow',     'accessory', 'Black bow',      0,    null, null, null, null, 220),
    ('av_acc_bear-clip',     'accessory', 'Bear clip',      0,    null, null, null, null, 230),
    ('av_acc_bunny-clip',    'accessory', 'Bunny clip',     120,  null, null, null, null, 240),
    ('av_acc_sakura-pin',    'accessory', 'Sakura pin',     150,  null, null, null, null, 250),
    ('av_acc_bow',           'accessory', 'Red bow',        150,  null, null, null, null, 260),
    ('av_acc_sunglasses',    'accessory', 'Sunglasses',     150,  null, null, null, null, 270),
    ('av_acc_catears',       'accessory', 'Cat ears',       200,  null, null, null, null, 280),
    ('av_acc_flower-crown',  'accessory', 'Flower crown',   220,  null, null, null, null, 290),
    ('av_acc_heart-glasses', 'accessory', 'Heart glasses',  0,    null, 'topik_tests', 1,   'Finish one TOPIK practice test', 300),
    -- room themes
    ('av_room_default',      'room_theme', 'Default',       0,    null, null, null, null, 410),
    ('av_room_classroom',    'room_theme', 'Classroom',     0,    null, null, null, null, 420),
    ('av_room_cafe',         'room_theme', 'Cafe',          800,  null, null, null, null, 430),
    ('av_room_seoul-night',  'room_theme', 'Seoul night',   800,  null, null, null, null, 440),
    ('av_room_winter',       'room_theme', 'Winter',        900,  array[12, 1, 2]::smallint[], null, null, null, 450),
    ('av_room_kpop-studio',  'room_theme', 'K-pop studio',  1200, null, null, null, null, 460),
    ('av_room_attic',        'room_theme', 'Starry attic',  0,    null, 'streak_days', 30,  'Study 30 days in a row', 470)
  ) as v(id, kind, name, price, months, goal_key, goal_target, label, sort)
on conflict (id) do update
  set kind = excluded.kind, name = excluded.name, price_nyang = excluded.price_nyang,
      sale_months = excluded.sale_months, unlock_goal_key = excluded.unlock_goal_key,
      unlock_goal_target = excluded.unlock_goal_target, unlock_label = excluded.unlock_label,
      sort = excluded.sort;

-- Free = no price and no study goal (owned by everyone).
create or replace function public.kh_avatar_item_free(p_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.avatar_items a
                  where a.id = p_id and a.active and a.price_nyang = 0 and a.unlock_goal_key is null);
$function$;
revoke execute on function public.kh_avatar_item_free(text) from public, anon, authenticated;
grant execute on function public.kh_avatar_item_free(text) to service_role;

-- ── 2. buy_room_item: room items + avatar items ────────────────────
-- Same body as 20261029_room_learning.sql plus the avatar_items lookup,
-- OUT_OF_SEASON and the unlock-only check for avatar items.
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
  v_is_av     boolean := false;
  v_price     int;
  v_coin      bigint;
  v_new_coin  bigint;
  v_owned     jsonb;
  v_name      text;
  v_month     int := extract(month from (now() at time zone 'Asia/Seoul'))::int;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;
  if p_item_id is null or length(p_item_id) = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_item from public.room_items where id = p_item_id and active = true;
  if found then
    v_price := coalesce(v_item.price_nyang, 0);
    v_name  := coalesce(v_item.name, p_item_id);
  else
    select * into v_av from public.avatar_items where id = p_item_id and active = true;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND');
    end if;
    v_is_av := true;
    v_price := coalesce(v_av.price_nyang, 0);
    v_name  := coalesce(v_av.name, p_item_id);
  end if;

  insert into public.user_room_state (user_id) values (v_user_id) on conflict (user_id) do nothing;

  select owned into v_owned from public.user_room_state where user_id = v_user_id for update;
  if v_owned ? p_item_id then
    select coalesce(coin_balance, 0) into v_new_coin from public.user_stats where user_id = v_user_id;
    return jsonb_build_object('ok', true, 'already_owned', true, 'nyang_balance', v_new_coin);
  end if;

  if (not v_is_av and exists (select 1 from public.room_unlocks where item_id = p_item_id and active = true))
     or (v_is_av and v_av.unlock_goal_key is not null) then
    return jsonb_build_object('ok', false, 'error', 'UNLOCK_ONLY');
  end if;

  if v_is_av and v_av.sale_months is not null and cardinality(v_av.sale_months) > 0
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
          case when v_is_av then 'avatar_item' else 'room_item' end, p_item_id,
          case when v_is_av then 'Character item: ' else 'Room item: ' end || v_name);

  return jsonb_build_object('ok', true, 'already_owned', false, 'price', v_price, 'nyang_balance', v_new_coin);
end;
$function$;
revoke execute on function public.buy_room_item(text) from public, anon;
grant execute on function public.buy_room_item(text) to authenticated, service_role;

-- ── 3. progress: streak from kh_user_streak ────────────────────────
create or replace function public.kh_room_unlock_progress(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
  v_streak  int := 0;
  v_day     date;
  v_words   int := 0;
  v_reads   int := 0;
  v_topik   int := 0;
  v_games   int := 0;
begin
  if p_uid is null then return '{}'::jsonb; end if;

  -- Streak: one source everywhere (kh_user_streak = daily_missions days,
  -- what Home / My Page show). Coin-ledger walk only if it's missing.
  if to_regprocedure('public.kh_user_streak(uuid)') is not null then
    execute 'select coalesce(public.kh_user_streak($1), 0)' into v_streak using p_uid;
  elsif to_regclass('public.coin_transactions') is not null then
    v_day := v_today;
    if not exists (select 1 from coin_transactions
                    where user_id = p_uid and tx_type = 'earn'
                      and (created_at at time zone 'Asia/Seoul')::date = v_day) then
      v_day := v_today - 1;
    end if;
    while v_streak < 400 and exists (
      select 1 from coin_transactions
       where user_id = p_uid and tx_type = 'earn'
         and created_at >= ((v_day::timestamp) at time zone 'Asia/Seoul')
         and created_at <  (((v_day + 1)::timestamp) at time zone 'Asia/Seoul')) loop
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  if to_regclass('public.coin_transactions') is not null then
    select count(*) into v_games from (
      select distinct reference_id, (created_at at time zone 'Asia/Seoul')::date
        from coin_transactions
       where user_id = p_uid and tx_type = 'earn' and source = 'game_complete'
    ) g;
  end if;

  if to_regclass('public.user_saved_words') is not null then
    execute 'select count(*) from public.user_saved_words where user_id = $1' into v_words using p_uid;
  end if;

  if to_regclass('public.articles') is not null then
    if to_regclass('public.read_articles') is not null and to_regclass('public.user_read_history') is not null then
      execute $q$
        select count(*) from (
          select article_id::text as id from public.read_articles where user_id = $1
          union
          select content_id::text from public.user_read_history where user_id = $1 and content_type = 'article'
        ) r where exists (select 1 from public.articles a where a.id::text = r.id)$q$
        into v_reads using p_uid;
    elsif to_regclass('public.read_articles') is not null then
      execute $q$
        select count(distinct ra.article_id::text) from public.read_articles ra
         where ra.user_id = $1 and exists (select 1 from public.articles a where a.id::text = ra.article_id::text)$q$
        into v_reads using p_uid;
    end if;
  end if;

  if to_regclass('public.topik_attempts') is not null and to_regclass('public.topik_tests') is not null then
    execute $q$
      select count(distinct ta.test_id) from public.topik_attempts ta
        join public.topik_tests tt on tt.id = ta.test_id
       where ta.user_id = $1 and ta.total > 0$q$
      into v_topik using p_uid;
  end if;

  return jsonb_build_object(
    'streak_days', coalesce(v_streak, 0), 'saved_words', v_words, 'articles_read', v_reads,
    'topik_tests', v_topik, 'games_played', v_games);
end;
$function$;
revoke execute on function public.kh_room_unlock_progress(uuid) from public, anon, authenticated;
grant execute on function public.kh_room_unlock_progress(uuid) to service_role;

-- ── claim: room unlocks + avatar unlocks ───────────────────────────
create or replace function public.kh_claim_room_unlocks()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_progress jsonb;
  v_owned    jsonb;
  v_new      jsonb := '[]'::jsonb;
  v_list     jsonb := '[]'::jsonb;
  v_av_new   jsonb := '[]'::jsonb;
  v_av_list  jsonb := '[]'::jsonb;
  r          record;
  v_cur      int;
  v_has      boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;

  v_progress := public.kh_room_unlock_progress(v_uid);

  -- Same row lock as buy_room_item, so a purchase and a claim can't race.
  insert into public.user_room_state (user_id) values (v_uid) on conflict (user_id) do nothing;
  select coalesce(owned, '[]'::jsonb) into v_owned from public.user_room_state where user_id = v_uid for update;

  for r in
    select u.item_id, u.goal_key, u.goal_target, u.label, u.sort, ri.name
      from public.room_unlocks u
      join public.room_items ri on ri.id = u.item_id and ri.active = true
     where u.active = true
     order by u.sort, u.item_id
  loop
    v_cur := coalesce((v_progress ->> r.goal_key)::int, 0);
    v_has := v_owned ? r.item_id;
    if not v_has and v_cur >= r.goal_target then
      v_owned := v_owned || jsonb_build_array(r.item_id);
      v_new := v_new || jsonb_build_array(r.item_id);
      v_has := true;
    end if;
    v_list := v_list || jsonb_build_array(jsonb_build_object(
      'item_id', r.item_id, 'name', r.name, 'goal_key', r.goal_key, 'goal_target', r.goal_target,
      'label', r.label, 'sort', r.sort, 'current', least(v_cur, r.goal_target),
      'done', v_cur >= r.goal_target, 'owned', v_has));
  end loop;

  -- Character items earned by studying (avatar_items with a goal).
  for r in
    select a.id as item_id, a.unlock_goal_key as goal_key, a.unlock_goal_target as goal_target,
           coalesce(a.unlock_label, '') as label, a.sort, a.name, a.kind
      from public.avatar_items a
     where a.active = true and a.unlock_goal_key is not null
     order by a.sort, a.id
  loop
    v_cur := coalesce((v_progress ->> r.goal_key)::int, 0);
    v_has := v_owned ? r.item_id;
    if not v_has and v_cur >= r.goal_target then
      v_owned := v_owned || jsonb_build_array(r.item_id);
      v_av_new := v_av_new || jsonb_build_array(r.item_id);
      v_has := true;
    end if;
    v_av_list := v_av_list || jsonb_build_array(jsonb_build_object(
      'item_id', r.item_id, 'name', r.name, 'kind', r.kind, 'goal_key', r.goal_key, 'goal_target', r.goal_target,
      'label', r.label, 'sort', r.sort, 'current', least(v_cur, r.goal_target),
      'done', v_cur >= r.goal_target, 'owned', v_has));
  end loop;

  if jsonb_array_length(v_new) > 0 or jsonb_array_length(v_av_new) > 0 then
    update public.user_room_state set owned = v_owned, updated_at = now() where user_id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'progress', v_progress, 'unlocks', v_list,
                            'new_items', v_new, 'owned', v_owned,
                            'avatar_unlocks', v_av_list, 'avatar_new_items', v_av_new);
end;
$function$;
revoke execute on function public.kh_claim_room_unlocks() from public, anon;
grant execute on function public.kh_claim_room_unlocks() to authenticated, service_role;

-- ── 4. get_public_room: + worn character and room theme ────────────
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
  v_theme   text;
  v_avatar  jsonb := null;
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

  -- Character: only free or owned pieces; anything else falls back.
  v_av := v_prefs -> 'avatar';
  if jsonb_typeof(v_av) = 'object' then
    v_hair := v_av ->> 'hair';
    if v_hair is null or v_hair not in ('long', 'short', 'bob', 'curly') then v_hair := 'long'; end if;
    v_outfit := v_av ->> 'outfit';
    if v_outfit is null or not (public.kh_avatar_item_free('av_outfit_' || v_outfit)
         or (v_owned ? ('av_outfit_' || v_outfit)
             and exists (select 1 from public.avatar_items a where a.id = 'av_outfit_' || v_outfit and a.active))) then
      v_outfit := 'tee';
    end if;
    if jsonb_typeof(v_av -> 'acc') = 'array' then
      select coalesce(jsonb_agg(to_jsonb(x.v) order by x.n), '[]'::jsonb) into v_acc from (
        select distinct on (e.v) e.v, e.n
          from jsonb_array_elements_text(v_av -> 'acc') with ordinality as e(v, n)
         where public.kh_avatar_item_free('av_acc_' || e.v)
            or (v_owned ? ('av_acc_' || e.v)
                and exists (select 1 from public.avatar_items a where a.id = 'av_acc_' || e.v and a.active))
         order by e.v, e.n
         limit 6
      ) x;
    end if;
    v_avatar := jsonb_build_object('hair', v_hair, 'outfit', v_outfit, 'acc', v_acc,
                                   'profile', coalesce(case when jsonb_typeof(v_av -> 'profile') = 'boolean'
                                                            then (v_av ->> 'profile')::boolean end, false));
  end if;

  -- Room theme picture (rooms[0]); 'classic' = wallpaper + floor below.
  v_theme := v_prefs #>> '{rooms,0,theme}';
  if v_theme is null or (v_theme <> 'classic' and not (public.kh_avatar_item_free('av_room_' || v_theme)
       or (v_owned ? ('av_room_' || v_theme)
           and exists (select 1 from public.avatar_items a where a.id = 'av_room_' || v_theme and a.active)))) then
    v_theme := 'classic';
  end if;

  -- Only owned (or free) items that are actually placed, plus the character
  -- (one entry, when the learner has one); at most 60.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_layout from (
    select e from jsonb_array_elements(case when jsonb_typeof(v_layout) = 'array' then v_layout else '[]'::jsonb end)
                  with ordinality as t(e, n)
     where jsonb_typeof(e) = 'object'
       and (v_owned ? (e ->> 'id')
            or exists (select 1 from public.room_items ri where ri.id = e ->> 'id' and coalesce(ri.price_nyang, 0) = 0)
            or (e ->> 'id' = 'kh_avatar' and v_avatar is not null
                and n = (select min(t2.n) from jsonb_array_elements(v_layout) with ordinality as t2(e2, n)
                          where t2.e2 ->> 'id' = 'kh_avatar')))
     order by n
     limit 60
  ) x;

  return jsonb_build_object(
    'layout', v_layout,
    'owned',  v_owned,
    'prefs',  jsonb_build_object(
                'theme', jsonb_build_object(
                  'wallpaper', coalesce(v_prefs #>> '{theme,wallpaper}', 'default'),
                  'floor',     coalesce(v_prefs #>> '{theme,floor}', 'none')),
                'room_theme', v_theme,
                'avatar', v_avatar));
end;
$function$;
revoke execute on function public.get_public_room(uuid) from public;
grant execute on function public.get_public_room(uuid) to anon, authenticated, service_role;
