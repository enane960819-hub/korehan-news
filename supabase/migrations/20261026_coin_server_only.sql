-- auto-apply
-- Nyang (coin_balance) becomes server-only (2026-10).
--
-- Before: the browser read coin_balance, added/subtracted, and wrote it
-- back (rewards, nickname change, room/shop/gift fallbacks), and several
-- SECURITY DEFINER functions trusted a client-supplied p_user_id — worst
-- of all admin_adjust_coin had no admin check, so any signed-in user could
-- mint nyang for themselves. After this migration:
--   * every coin change goes through a SECURITY DEFINER function below,
--   * functions act only on auth.uid(),
--   * authenticated/anon lose INSERT/UPDATE on user_stats.coin_balance and
--     write access to the coin_transactions ledger.
-- Idempotent: safe to re-run.

-- ── Reward amounts (server-side; mirrors the old client table) ──────
create table if not exists public.coin_reward_config (
  action_key  text primary key,
  coin_amount int  not null default 0,
  daily_cap   int  not null default 30   -- max rewarded grants per KST day
);
alter table public.coin_reward_config enable row level security;
drop policy if exists coin_reward_config_read on public.coin_reward_config;
create policy coin_reward_config_read on public.coin_reward_config for select using (true);

insert into public.coin_reward_config (action_key, coin_amount, daily_cap) values
  ('article_read', 3, 20), ('word_save', 2, 40), ('word_saved', 2, 40),
  ('conv_quiz_complete', 5, 10), ('fill_complete', 2, 20),
  ('daily_mission_complete', 20, 1), ('conversation_read', 3, 20),
  ('writing_submit', 5, 3), ('study_picture_description', 3, 5),
  ('study_sentence_writing', 3, 5), ('quiz_complete', 5, 10),
  ('daily_review_complete', 8, 1), ('weekly_review_complete', 12, 1)
on conflict (action_key) do update
  set coin_amount = excluded.coin_amount, daily_cap = excluded.daily_cap;

-- ── award_xp: own user only, server dedupe, grants coins itself ─────
create or replace function public.award_xp(p_user_id uuid, p_action text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid         uuid := auth.uid();
  v_xp_amount   int := 0;
  v_is_active   boolean;
  v_coin_amount int := 0;
  v_cap         int := 30;
  v_content     text := nullif(coalesce(p_meta->>'content_id', p_meta->>'article_id', ''), '');
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_today_n     int;
  v_total_xp    int;
  v_new_level   int;
  v_prev_level  int;
  v_level_name  text;
  v_coin_after  bigint;
  v_level_names text[] := array['입문자','초학자','학생','수련생','독학자','탐구자','학자','통달자','달인','마스터'];
begin
  if v_uid is null or p_user_id is distinct from v_uid then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select xp_amount, is_active into v_xp_amount, v_is_active from xp_config where action_key = p_action;
  if not found or not v_is_active then v_xp_amount := 0; end if;
  select coin_amount, daily_cap into v_coin_amount, v_cap from coin_reward_config where action_key = p_action;
  v_coin_amount := coalesce(v_coin_amount, 0);
  v_cap := coalesce(v_cap, 30);

  if v_xp_amount = 0 and v_coin_amount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'action not found or inactive');
  end if;

  -- Same content, same action, same KST day → nothing (client used to be the only guard).
  if v_content is not null and exists (
    select 1 from xp_log
     where user_id = v_uid and action_key = p_action
       and coalesce(meta->>'content_id', meta->>'article_id') = v_content
       and (created_at at time zone 'Asia/Seoul')::date = v_today) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'xp_gained', 0, 'coin_gained', 0);
  end if;

  select count(*) into v_today_n from xp_log
   where user_id = v_uid and action_key = p_action
     and (created_at at time zone 'Asia/Seoul')::date = v_today;
  if v_today_n >= v_cap then
    return jsonb_build_object('ok', true, 'capped', true, 'xp_gained', 0, 'coin_gained', 0);
  end if;

  insert into xp_log (user_id, action_key, xp_amount, meta) values (v_uid, p_action, v_xp_amount, p_meta);

  select coalesce(level, 1) into v_prev_level from user_stats where user_id = v_uid;
  insert into user_stats (user_id, total_xp) values (v_uid, v_xp_amount)
  on conflict (user_id) do update set total_xp = coalesce(user_stats.total_xp, 0) + v_xp_amount, updated_at = now()
  returning total_xp into v_total_xp;

  v_new_level := greatest(1, least(10, case
    when v_total_xp < 200 then 1 when v_total_xp < 600 then 2 when v_total_xp < 1400 then 3
    when v_total_xp < 3000 then 4 when v_total_xp < 5500 then 5 when v_total_xp < 9000 then 6
    when v_total_xp < 14000 then 7 when v_total_xp < 21000 then 8 when v_total_xp < 30000 then 9
    else 10 end));
  v_level_name := v_level_names[v_new_level];

  update user_stats
     set level = v_new_level, level_name = v_level_name,
         coin_balance = coalesce(coin_balance, 0) + v_coin_amount
   where user_id = v_uid
  returning coin_balance into v_coin_after;

  if v_coin_amount > 0 then
    insert into coin_transactions (user_id, tx_type, amount, balance_after, source, reference_id, memo)
    values (v_uid, 'earn', v_coin_amount, v_coin_after, p_action, v_content, p_action);
  end if;

  return jsonb_build_object(
    'ok', true, 'xp_gained', v_xp_amount, 'total_xp', v_total_xp,
    'level', v_new_level, 'level_name', v_level_name,
    'leveled_up', v_new_level > coalesce(v_prev_level, 1),
    'coin_gained', v_coin_amount, 'coin_balance', v_coin_after);
end;
$function$;

-- ── First Journey rewards: once per step; the bonus only after every step ──
create or replace function public.kh_claim_first_journey(p_step text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_amount int;
  v_steps  text[] := array['read','save_words','study','convo','growth','shop','room'];
  v_after  bigint;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); end if;
  v_amount := case p_step
    when 'read' then 10 when 'save_words' then 5 when 'study' then 5 when 'convo' then 5
    when 'growth' then 5 when 'shop' then 10 when 'room' then 10 when 'complete' then 50
    else null end;
  if v_amount is null then return jsonb_build_object('ok', false, 'error', 'UNKNOWN_STEP'); end if;

  perform 1 from user_stats where user_id = v_uid for update;
  if exists (select 1 from coin_transactions where user_id = v_uid and source = 'first_journey' and reference_id = p_step) then
    return jsonb_build_object('ok', true, 'already_claimed', true, 'coin_gained', 0);
  end if;
  if p_step = 'complete' and (
    select count(distinct reference_id) from coin_transactions
     where user_id = v_uid and source = 'first_journey' and reference_id = any(v_steps)) < array_length(v_steps, 1) then
    return jsonb_build_object('ok', false, 'error', 'NOT_COMPLETE');
  end if;

  insert into user_stats (user_id) values (v_uid) on conflict (user_id) do nothing;
  update user_stats set coin_balance = coalesce(coin_balance, 0) + v_amount where user_id = v_uid
  returning coin_balance into v_after;
  insert into coin_transactions (user_id, tx_type, amount, balance_after, source, reference_id, memo)
  values (v_uid, 'earn', v_amount, v_after, 'first_journey', p_step, 'First Journey: ' || p_step);
  return jsonb_build_object('ok', true, 'coin_gained', v_amount, 'coin_balance', v_after);
end;
$function$;

-- ── Nickname change (100 nyang) ─────────────────────────────────────
create or replace function public.kh_change_nickname(p_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_cost  int := 100;
  v_coin  bigint;
  v_after bigint;
  v_name  text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED'); end if;
  if length(v_name) = 0 or length(v_name) > 30 then return jsonb_build_object('ok', false, 'error', 'INVALID_NAME'); end if;
  select coalesce(coin_balance, 0) into v_coin from user_stats where user_id = v_uid for update;
  if coalesce(v_coin, 0) < v_cost then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_cost, 'current', coalesce(v_coin, 0));
  end if;
  -- display_name goes through the existing validate_display_name trigger.
  update user_stats set coin_balance = v_coin - v_cost, display_name = v_name, updated_at = now()
   where user_id = v_uid returning coin_balance into v_after;
  insert into coin_transactions (user_id, tx_type, amount, balance_after, source, memo)
  values (v_uid, 'spend', -v_cost, v_after, 'nickname_change', v_name);
  return jsonb_build_object('ok', true, 'coin_balance', v_after, 'display_name', v_name);
end;
$function$;

-- ── Existing functions: act on auth.uid() only ──────────────────────
create or replace function public.admin_adjust_coin(p_user_id uuid, p_delta bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coin bigint;
  v_new bigint;
begin
  -- Had no check at all: any signed-in user could mint nyang.
  if not public.is_admin_email() then
    return jsonb_build_object('ok', false, 'error', 'ADMIN_ONLY');
  end if;
  select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id for update;
  v_new := greatest(0, coalesce(v_coin, 0) + p_delta);
  update public.user_stats set coin_balance = v_new where user_id = p_user_id;
  insert into public.coin_transactions(user_id, tx_type, amount, balance_after, source, memo)
  values (p_user_id, 'admin_adjust', p_delta, v_new, 'admin', p_reason);
  return jsonb_build_object('ok', true, 'coin_balance', v_new);
end;
$function$;

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
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  select * into v_item from public.shop_items where id = p_item_id and is_active = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_FOUND'); end if;
  if not v_item.can_buy_with_coin then return jsonb_build_object('ok', false, 'error', 'COIN_NOT_ALLOWED'); end if;

  select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id for update;
  if coalesce(v_coin, 0) < coalesce(v_item.coin_price,0) then
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
$function$;

create or replace function public.send_reporter_gift(p_item_id text, p_reporter_id text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item public.shop_items%rowtype;
  v_owned int;
  v_coin bigint;
  v_new_coin bigint;
  v_cost bigint;
  v_used_owned boolean := false;
  v_aff_add bigint;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if coalesce(p_reporter_id,'') = '' or coalesce(p_item_id,'') = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select * into v_item from public.shop_items
   where id = p_item_id and is_active = true and item_type = 'reporter_item';
  if not found then return jsonb_build_object('ok', false, 'error', 'ITEM_NOT_GIFTABLE'); end if;

  v_cost := coalesce(v_item.coin_price, 0);
  select coalesce(quantity, 0) into v_owned from public.owned_items where user_id = p_user_id and item_id = p_item_id;

  if coalesce(v_owned, 0) > 0 then
    update public.owned_items set quantity = quantity - 1 where user_id = p_user_id and item_id = p_item_id;
    delete from public.owned_items where user_id = p_user_id and item_id = p_item_id and quantity <= 0;
    v_used_owned := true;
    select coalesce(coin_balance,0) into v_new_coin from public.user_stats where user_id = p_user_id;
  else
    select coalesce(coin_balance,0) into v_coin from public.user_stats where user_id = p_user_id for update;
    if coalesce(v_coin, 0) < v_cost then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_NYANG', 'required', v_cost, 'current', coalesce(v_coin, 0));
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
  do update set gift_count = reporter_user_affinity.gift_count + 1,
                affinity_points = reporter_user_affinity.affinity_points + excluded.affinity_points,
                updated_at = now();

  select coalesce(quantity, 0) into v_owned from public.owned_items where user_id = p_user_id and item_id = p_item_id;
  return jsonb_build_object('ok', true, 'success', true, 'used_owned', v_used_owned,
    'nyang_balance', coalesce(v_new_coin, v_coin, 0), 'remaining_owned', coalesce(v_owned,0));
end;
$function$;

-- ── Execute grants: signed-in users only ────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.award_xp(uuid, text, jsonb)', 'public.kh_claim_first_journey(text)', 'public.kh_change_nickname(text)',
    'public.admin_adjust_coin(uuid, bigint, text)', 'public.purchase_coin_shop_item(uuid, text)',
    'public.send_reporter_gift(text, text, uuid)', 'public.buy_room_item(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ── user_stats: no client writes to coin_balance ────────────────────
revoke insert, update on public.user_stats from anon, authenticated;
revoke delete, truncate, trigger, references on public.user_stats from anon;
revoke truncate, trigger, references on public.user_stats from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'user_stats' and column_name <> 'coin_balance';
  execute format('grant insert (%s) on public.user_stats to authenticated', cols);
  execute format('grant update (%s) on public.user_stats to authenticated', cols);
end $$;

-- ── coin_transactions is a server-written ledger ────────────────────
revoke insert, update, delete, truncate on public.coin_transactions from anon, authenticated;
