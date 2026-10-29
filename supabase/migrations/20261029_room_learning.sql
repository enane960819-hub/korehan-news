-- auto-apply
-- My Room, learning version (2026-10-29): study unlocks, a friend's room on
-- the public profile, and room likes. Idempotent: safe to re-run.
--
-- 1. STUDY UNLOCKS (room_unlocks + kh_claim_room_unlocks)
--    Some room items are earned by studying instead of bought with nyang.
--    room_unlocks maps a room item to a goal (goal_key + goal_target). The
--    list is public (anyone can read it, nobody but service_role writes it).
--    kh_claim_room_unlocks() (SECURITY DEFINER) works out the caller's
--    progress on the server, appends every reached item to
--    user_room_state.owned and returns progress for every unlock.
--    It is the SECOND allowed writer of user_room_state.owned (after
--    buy_room_item; see 20261029_my_room_ownership_prices.sql). It never
--    removes items and never touches nyang.
--    Progress sources (all read on the server, never sent by the browser):
--      streak_days   — consecutive KST days (ending today or yesterday) with
--                      at least one nyang 'earn' row in coin_transactions.
--                      That ledger is written only by server functions
--                      (award_xp, first-journey claims), so it can't be
--                      padded from the console.
--      games_played  — distinct (game, KST day) pairs of game_complete rows
--                      in the same ledger (award_xp gives one per game per
--                      day, at most 5 a day).
--      saved_words   — rows in user_saved_words.
--      articles_read — distinct articles in read_articles / user_read_history
--                      that still exist in public.articles.
--      topik_tests   — distinct TOPIK practice tests with a finished attempt
--                      (topik_attempts joined to topik_tests, total > 0).
--    Saved words / reads / TOPIK attempts are the learner's own records (the
--    same ones badges use); they're checked against real articles / tests.
--    An unlock item can't be bought: buy_room_item returns UNLOCK_ONLY for
--    it (an owner keeps it either way).
--
-- 2. FRIEND'S ROOM (get_public_room)
--    user_room_state stays owner-only. get_public_room(p_user) returns just
--    that learner's room: layout (owned items only), owned, and the room
--    theme from prefs (wallpaper / floor). No other prefs, nothing else.
--    Hidden when either side blocked the other.
--
-- 3. ROOM LIKES (room_likes, get_room_likes, toggle_room_like)
--    One like per (liker, owner); you can't like your own room. RLS: insert
--    and delete only your own like; rows are visible to the liker and the
--    owner. Counts come from get_room_likes (SECURITY DEFINER, count only).
--
-- 4. PUBLIC BADGES (get_public_badges)
--    The public profile shows a learner's earned badges; user_badges is
--    owner-only, so this returns just the badge ids.

-- ── 1. room_unlocks ────────────────────────────────────────────────
create table if not exists public.room_unlocks (
  item_id     text primary key references public.room_items(id) on delete cascade,
  goal_key    text not null check (goal_key in ('streak_days', 'saved_words', 'articles_read', 'topik_tests', 'games_played')),
  goal_target int  not null check (goal_target > 0),
  label       text not null,
  sort        int  not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.room_unlocks enable row level security;
drop policy if exists room_unlocks_read on public.room_unlocks;
create policy room_unlocks_read on public.room_unlocks for select using (true);
revoke insert, update, delete, truncate, trigger, references on public.room_unlocks from anon, authenticated;
grant select on public.room_unlocks to anon, authenticated;

-- Seed: only items that have art today (the ~29 art-less ones hide themselves).
-- A re-run refreshes goal / label / sort but keeps an admin's `active` choice.
insert into public.room_unlocks (item_id, goal_key, goal_target, label, sort)
select v.item_id, v.goal_key, v.goal_target, v.label, v.sort
  from (values
    ('lamp',             'streak_days',     7, 'Study 7 days in a row',          10),
    ('cushion',          'articles_read',  25, 'Read 25 articles',               20),
    ('espresso_machine', 'saved_words',    50, 'Save 50 words',                  30),
    ('standing_desk',    'topik_tests',     1, 'Finish one TOPIK practice test', 40),
    ('gaming_desk',      'games_played',   10, 'Play 10 Playground games',       50),
    ('bookshelf',        'saved_words',   150, 'Save 150 words',                 60),
    ('neon_hwaiting',    'streak_days',    30, 'Study 30 days in a row',         70),
    ('sofa_2seat',       'articles_read', 100, 'Read 100 articles',              80),
    ('byobu',            'saved_words',   500, 'Save 500 words',                 90)
  ) as v(item_id, goal_key, goal_target, label, sort)
 where exists (select 1 from public.room_items r where r.id = v.item_id)
on conflict (item_id) do update
  set goal_key = excluded.goal_key, goal_target = excluded.goal_target,
      label = excluded.label, sort = excluded.sort;

-- ── progress (server-side; internal helper, not callable by browsers) ──
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

  -- Streak: walk back from today (or yesterday, if today has nothing yet).
  if to_regclass('public.coin_transactions') is not null then
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
    'streak_days', v_streak, 'saved_words', v_words, 'articles_read', v_reads,
    'topik_tests', v_topik, 'games_played', v_games);
end;
$function$;
revoke execute on function public.kh_room_unlock_progress(uuid) from public, anon, authenticated;
grant execute on function public.kh_room_unlock_progress(uuid) to service_role;

-- ── claim ─────────────────────────────────────────────────────────
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

  if jsonb_array_length(v_new) > 0 then
    update public.user_room_state set owned = v_owned, updated_at = now() where user_id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'progress', v_progress, 'unlocks', v_list,
                            'new_items', v_new, 'owned', v_owned);
end;
$function$;
revoke execute on function public.kh_claim_room_unlocks() from public, anon;
grant execute on function public.kh_claim_room_unlocks() to authenticated, service_role;

-- ── buy_room_item: unlock items are earned, not bought ─────────────
-- Same body as 20261012_reapply_missing_objects.sql plus the UNLOCK_ONLY
-- check (after the already-owned check, so owners still get a clean answer).
create or replace function public.buy_room_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id   uuid   := auth.uid();
  v_item      public.room_items%rowtype;
  v_price     int;
  v_coin      bigint;
  v_new_coin  bigint;
  v_owned     jsonb;
  v_name      text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;
  if p_item_id is null or length(p_item_id) = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_item from public.room_items where id = p_item_id and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND');
  end if;
  v_price := coalesce(v_item.price_nyang, 0);
  v_name  := coalesce(v_item.name, p_item_id);

  insert into public.user_room_state (user_id) values (v_user_id) on conflict (user_id) do nothing;

  select owned into v_owned from public.user_room_state where user_id = v_user_id for update;
  if v_owned ? p_item_id then
    select coalesce(coin_balance, 0) into v_new_coin from public.user_stats where user_id = v_user_id;
    return jsonb_build_object('ok', true, 'already_owned', true, 'nyang_balance', v_new_coin);
  end if;

  if exists (select 1 from public.room_unlocks where item_id = p_item_id and active = true) then
    return jsonb_build_object('ok', false, 'error', 'UNLOCK_ONLY');
  end if;

  select coalesce(coin_balance, 0) into v_coin from public.user_stats where user_id = v_user_id for update;
  if v_coin < v_price then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_price, 'current', v_coin);
  end if;

  v_new_coin := v_coin - v_price;
  update public.user_stats set coin_balance = v_new_coin where user_id = v_user_id;

  update public.user_room_state
     set owned = coalesce(owned, '[]'::jsonb) || jsonb_build_array(p_item_id), updated_at = now()
   where user_id = v_user_id;

  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, reference_id, memo)
  values (v_user_id, 'spend', -v_price, v_new_coin, 'room_item', p_item_id, 'Room item: ' || v_name);

  return jsonb_build_object('ok', true, 'already_owned', false, 'price', v_price, 'nyang_balance', v_new_coin);
end;
$function$;
revoke execute on function public.buy_room_item(text) from public, anon;
grant execute on function public.buy_room_item(text) to authenticated, service_role;

-- ── 2. get_public_room ─────────────────────────────────────────────
create or replace function public.get_public_room(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_layout jsonb;
  v_owned  jsonb;
  v_prefs  jsonb;
  v_viewer uuid := auth.uid();
begin
  if p_user is null then return null; end if;
  if v_viewer is not null and v_viewer <> p_user and to_regprocedure('public.is_blocked(uuid,uuid)') is not null then
    if public.is_blocked(v_viewer, p_user) then return null; end if;
  end if;

  select coalesce(s.layout, '[]'::jsonb), coalesce(s.owned, '[]'::jsonb), coalesce(s.prefs, '{}'::jsonb)
    into v_layout, v_owned, v_prefs
    from public.user_room_state s where s.user_id = p_user;
  if not found then return null; end if;

  -- Only owned (or free) items that are actually placed; at most 60.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_layout from (
    select e from jsonb_array_elements(case when jsonb_typeof(v_layout) = 'array' then v_layout else '[]'::jsonb end) e
     where jsonb_typeof(e) = 'object'
       and (v_owned ? (e ->> 'id')
            or exists (select 1 from public.room_items ri where ri.id = e ->> 'id' and coalesce(ri.price_nyang, 0) = 0))
     limit 60
  ) x;

  return jsonb_build_object(
    'layout', v_layout,
    'owned',  v_owned,
    'prefs',  jsonb_build_object('theme', jsonb_build_object(
                'wallpaper', coalesce(v_prefs #>> '{theme,wallpaper}', 'default'),
                'floor',     coalesce(v_prefs #>> '{theme,floor}', 'none'))));
end;
$function$;
revoke execute on function public.get_public_room(uuid) from public;
grant execute on function public.get_public_room(uuid) to anon, authenticated, service_role;

-- ── 3. room_likes ─────────────────────────────────────────────────
create table if not exists public.room_likes (
  liker_id   uuid not null references auth.users(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, owner_id),
  check (liker_id <> owner_id)
);
create index if not exists room_likes_owner_idx on public.room_likes (owner_id);

alter table public.room_likes enable row level security;
drop policy if exists room_likes_select_own on public.room_likes;
create policy room_likes_select_own on public.room_likes
  for select using (auth.uid() = liker_id or auth.uid() = owner_id);
drop policy if exists room_likes_insert_own on public.room_likes;
create policy room_likes_insert_own on public.room_likes
  for insert with check (
    auth.uid() = liker_id and liker_id <> owner_id
    and not public.is_blocked(liker_id, owner_id));
drop policy if exists room_likes_delete_own on public.room_likes;
create policy room_likes_delete_own on public.room_likes
  for delete using (auth.uid() = liker_id);

revoke all on public.room_likes from anon;
revoke update, truncate, trigger, references on public.room_likes from authenticated;
grant select, insert, delete on public.room_likes to authenticated;

create or replace function public.get_room_likes(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'count', (select count(*) from public.room_likes where owner_id = p_owner),
    'liked', coalesce(auth.uid() is not null and exists (
               select 1 from public.room_likes where owner_id = p_owner and liker_id = auth.uid()), false));
$function$;
revoke execute on function public.get_room_likes(uuid) from public;
grant execute on function public.get_room_likes(uuid) to anon, authenticated, service_role;

-- Toggle runs as the caller, so the RLS policies above are what allow it.
create or replace function public.toggle_room_like(p_owner uuid)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); end if;
  if p_owner is null or p_owner = v_uid then return jsonb_build_object('ok', false, 'error', 'INVALID_OWNER'); end if;
  if public.is_blocked(v_uid, p_owner) then return jsonb_build_object('ok', false, 'error', 'BLOCKED'); end if;
  delete from public.room_likes where liker_id = v_uid and owner_id = p_owner;
  if not found then
    insert into public.room_likes (liker_id, owner_id) values (v_uid, p_owner) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true) || public.get_room_likes(p_owner);
end;
$function$;
revoke execute on function public.toggle_room_like(uuid) from public, anon;
grant execute on function public.toggle_room_like(uuid) to authenticated;

-- ── 4. get_public_badges ──────────────────────────────────────────
create or replace function public.get_public_badges(p_user uuid)
returns text[]
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_ids text[];
begin
  if p_user is null or to_regclass('public.user_badges') is null then return array[]::text[]; end if;
  execute 'select coalesce(array_agg(distinct badge_id order by badge_id), array[]::text[]) from public.user_badges where user_id = $1'
    into v_ids using p_user;
  return v_ids;
end;
$function$;
revoke execute on function public.get_public_badges(uuid) from public;
grant execute on function public.get_public_badges(uuid) to anon, authenticated, service_role;
