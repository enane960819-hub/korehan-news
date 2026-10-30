-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Nyang economy + user_stats write lock (2026-10-30 security pass)
-- ═════════════════════════════════════════════════════════════════════
-- 1. award_xp (replaces 20261026_coin_server_only.sql's version):
--    * DAILY NYANG CAP: at most 120 nyang per KST day from award_xp across
--      every action. Room / shop prices were tuned to ~50 nyang a day of
--      regular study (≈95 for a learner who clears every Daily Mission) in
--      20261029_my_room_ownership_prices.sql, but the per-action caps in
--      coin_reward_config add up to ~515 a day, so a farming script could
--      earn ~10 days of prices in one. 120 leaves a full-mission day
--      untouched and cuts farming to ~2.5 days' worth. XP is not capped
--      (only nyang). The cap counts coin_transactions rows award_xp wrote
--      (source = a coin_reward_config key); First Journey, room unlocks and
--      admin grants are not counted and not capped.
--    * word_save / word_saved are ONE action for coins and caps: the Daily
--      Mission path sends 'word_save', the Learning Hub word panel sends
--      'word_saved', and both used to pay (2 + 2 per word, 40 + 40 a day).
--      'word_saved' now pays from the 'word_save' row and shares its daily
--      cap and same-content dedupe; XP still comes from xp_config per key.
--    * per-user advisory lock, so parallel calls can't race past the
--      dedupe / caps.
--    * also adds the XP to user_stats.xp (on insert and on conflict), next to
--      total_xp as before. Past rows are not backfilled.
-- 2. user_stats: 20261026 granted the browser INSERT/UPDATE on every column
--    except coin_balance, so xp / streak / level / writing_tickets could be
--    set from the console. Now the browser keeps INSERT/UPDATE only on the
--    columns it legitimately writes (profile/onboarding fields, the activity
--    counters, last_mission_date, preferences). xp, total_xp, level,
--    level_name, xp_spent, streak, mission_streak, writing_tickets,
--    coin_balance, equipped_cosmetics, email and anything not listed are
--    server-only (SECURITY DEFINER functions / service_role).
-- Schema/function/grant changes only; no rows are rewritten.
-- Idempotent: safe to re-run.

create or replace function public.award_xp(p_user_id uuid, p_action text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_daily_coin_cap constant int := 120;  -- nyang / KST day from award_xp (see header)
  v_uid         uuid := auth.uid();
  v_xp_amount   int := 0;
  v_is_active   boolean;
  v_coin_key    text := case when p_action = 'word_saved' then 'word_save' else p_action end;
  v_keys        text[] := case when p_action in ('word_save', 'word_saved')
                               then array['word_save', 'word_saved'] else array[p_action] end;
  v_coin_amount int := 0;
  v_cap         int := 30;
  v_content     text := nullif(coalesce(p_meta->>'content_id', p_meta->>'article_id', ''), '');
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start   timestamptz := (now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul';
  v_today_n     int;
  v_coins_today bigint;
  v_coin_capped boolean := false;
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

  -- Serialise this learner's grants so dedupe + caps can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('award_xp:' || v_uid::text, 0));

  select xp_amount, is_active into v_xp_amount, v_is_active from xp_config where action_key = p_action;
  if not found or not v_is_active then v_xp_amount := 0; end if;
  v_xp_amount := coalesce(v_xp_amount, 0);
  select coin_amount, daily_cap into v_coin_amount, v_cap from coin_reward_config where action_key = v_coin_key;
  v_coin_amount := coalesce(v_coin_amount, 0);
  v_cap := coalesce(v_cap, 30);

  if v_xp_amount = 0 and v_coin_amount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'action not found or inactive');
  end if;

  -- Same content, same action (word_save ≡ word_saved), same KST day → nothing.
  if v_content is not null and exists (
    select 1 from xp_log
     where user_id = v_uid and action_key = any(v_keys)
       and coalesce(meta->>'content_id', meta->>'article_id') = v_content
       and created_at >= v_day_start) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'xp_gained', 0, 'coin_gained', 0);
  end if;

  select count(*) into v_today_n from xp_log
   where user_id = v_uid and action_key = any(v_keys)
     and created_at >= v_day_start;
  if v_today_n >= v_cap then
    return jsonb_build_object('ok', true, 'capped', true, 'xp_gained', 0, 'coin_gained', 0);
  end if;

  -- Total daily nyang cap across all award_xp actions.
  if v_coin_amount > 0 then
    select coalesce(sum(amount), 0) into v_coins_today
      from coin_transactions
     where user_id = v_uid and tx_type = 'earn'
       and created_at >= v_day_start
       and (source in (select action_key from coin_reward_config) or source = 'word_saved');
    if v_coins_today + v_coin_amount > c_daily_coin_cap then
      v_coin_amount := greatest(0, c_daily_coin_cap - v_coins_today)::int;
      v_coin_capped := true;
    end if;
  end if;

  insert into xp_log (user_id, action_key, xp_amount, meta) values (v_uid, p_action, v_xp_amount, p_meta);

  select coalesce(level, 1) into v_prev_level from user_stats where user_id = v_uid;
  insert into user_stats (user_id, total_xp, xp) values (v_uid, v_xp_amount, v_xp_amount)
  on conflict (user_id) do update
    set total_xp   = coalesce(user_stats.total_xp, 0) + v_xp_amount,
        xp         = coalesce(user_stats.xp, 0) + v_xp_amount,
        updated_at = now()
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
    'coin_gained', v_coin_amount, 'coin_balance', v_coin_after,
    'coin_capped', v_coin_capped);
end;
$function$;

revoke all on function public.award_xp(uuid, text, jsonb) from public;
revoke all on function public.award_xp(uuid, text, jsonb) from anon;
grant execute on function public.award_xp(uuid, text, jsonb) to authenticated, service_role;

-- ── user_stats: browser writes only these columns ─────────────────────
-- Table-level REVOKE also drops the per-column grants from 20261026.
revoke insert, update on public.user_stats from anon, authenticated;
do $$
declare
  v_allowed text[] := array[
    'user_id', 'display_name', 'updated_at',
    'articles_read', 'words_saved', 'quizzes_done', 'fill_done', 'last_mission_date',
    'onboarded', 'onboarded_at', 'goal_type', 'daily_goal_minutes', 'detected_level',
    'level_test_score', 'preferences'
  ];
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'user_stats'
     and column_name = any(v_allowed);
  if v_cols is not null then
    execute format('grant insert (%s) on public.user_stats to authenticated', v_cols);
    execute format('grant update (%s) on public.user_stats to authenticated', v_cols);
  end if;
end $$;

notify pgrst, 'reload schema';
