-- auto-apply
-- Playground games earn a small completion reward through the existing
-- server path: award_xp(p_user_id, 'game_complete', {content_id:'game:<id>'})
-- (20261026_coin_server_only.sql). award_xp already gives each content_id
-- one grant per KST day, and daily_cap below caps the action across all
-- games — so at most 5 rewarded games a day (50 XP, 10 nyang), and replaying
-- the same game the same day gives nothing. The browser never writes XP or
-- coins for this (khGameComplete in korehan-shared.js). Idempotent.
do $$
begin
  if to_regclass('public.xp_config') is not null then
    if exists (select 1 from public.xp_config where action_key = 'game_complete') then
      update public.xp_config set xp_amount = 10, is_active = true
       where action_key = 'game_complete' and (xp_amount is distinct from 10 or is_active is distinct from true);
    else
      insert into public.xp_config (action_key, action_label, xp_amount, category, is_active)
      values ('game_complete', 'Playground game complete', 10, 'game', true);
    end if;
  end if;

  if to_regclass('public.coin_reward_config') is not null then
    insert into public.coin_reward_config (action_key, coin_amount, daily_cap)
    values ('game_complete', 2, 5)
    on conflict (action_key) do update
      set coin_amount = excluded.coin_amount, daily_cap = excluded.daily_cap;
  end if;
end $$;
