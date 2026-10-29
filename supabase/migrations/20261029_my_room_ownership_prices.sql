-- auto-apply
-- My Room (2026-10-29): server-only ownership, synced room prefs, room item prices
-- re-set to fit the nyang economy. Idempotent: safe to re-run.
--
-- 1. OWNERSHIP IS SERVER-ONLY
--    user_room_state had owner-only RLS but no column lockdown, and the browser
--    upserted the whole row ({layout, owned}) on every change — so any learner
--    could write any item id into `owned` from the console and get it free.
--    After this migration:
--      * anon/authenticated lose table-level INSERT/UPDATE/DELETE; they keep
--        column-level INSERT/UPDATE on (user_id, layout, prefs, updated_at)
--        only, so the client can still save placement + room prefs;
--      * a BEFORE INSERT/UPDATE trigger also pins `owned` for those roles
--        (defence in depth if a later "grant all" re-opens the table);
--      * only buy_room_item (SECURITY DEFINER, runs as the function owner)
--        and service_role change `owned`. Existing rows are untouched, so
--        everyone keeps what they own.
--    Starter items: the client used to grant ['character','plant'] by writing
--    `owned` itself. That now comes from the column DEFAULT, applied when the
--    learner's row is first created (by the client's layout save or by
--    buy_room_item). Price-0 room items are treated as owned by everyone.
--
-- 2. ROOM PREFS
--    New `prefs jsonb` column so wallpaper/floor, background sound and pet
--    affinity follow the learner across devices (was localStorage only).
--
-- 3. PRICES (room_items.price_nyang) — earning-rate math
--    Nyang only comes from the server (20261026_coin_server_only.sql):
--      award_xp → coin_reward_config (per KST day, capped):
--        article_read 3 (cap 20), conversation_read 3 (20), word_save /
--        word_saved 2 (40), quiz_complete 5 (10), conv_quiz_complete 5 (10),
--        fill_complete 2 (20), writing_submit 5 (3), study_picture_description
--        3 (5), study_sentence_writing 3 (5), daily_mission_complete 20 (1),
--        daily_review_complete 8 (1), weekly_review_complete 12 (1).
--      kh_claim_first_journey: 100 once (7 steps + 50 bonus).
--      Streak milestones give XP only, no nyang.
--    A full Daily Mission day (3 articles + 20 words + 3 quizzes + 1 fill +
--    20 bonus) = 9 + 40 + 15 + 2 + 20 = 86, plus the daily review 8 ≈ 95/day.
--    A light day (1 article, 10 words, 1 quiz, 1 fill) ≈ 30.
--    "Regular study" (the target learner) ≈ 50 nyang/day × 5 days ≈ 250/week
--    ≈ 1,000/month; a learner who clears every Daily Mission makes ≈ 650/week.
--    (The QA learner's 861 nyang = First Journey + several full days.)
--    Old prices (3–80, King Sejong 500) were one sitting's worth. New tiers:
--      starter  60–140  → 1–3 study days
--      low     170–310  → about a week
--      mid     340–620  → 1–2.5 weeks
--      upper   660–960  → 3–4 weeks (1.5–2 at full-mission pace)
--      King Sejong 2,400 → ≈ 2 months regular / ≈ 1 month of full missions
--    Rule: new = old × 12 rounded to 10 (minimum 60); price 0 stays free;
--    King Sejong set by hand. Each UPDATE is guarded on the old price, so a
--    re-run (or a price the admin already changed) is a no-op. Ownership is
--    separate (user_room_state.owned) — nobody loses an item they own.

-- ── 1. prefs column + starter default ──────────────────────────────
alter table public.user_room_state add column if not exists prefs jsonb not null default '{}'::jsonb;
alter table public.user_room_state alter column owned set default '["character","plant"]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_room_state_prefs_size') then
    alter table public.user_room_state
      add constraint user_room_state_prefs_size check (pg_column_size(prefs) <= 16384);
  end if;
end $$;

-- ── 2. column lockdown ─────────────────────────────────────────────
revoke insert, update, delete, truncate, trigger, references on public.user_room_state from anon, authenticated;
grant select on public.user_room_state to authenticated;
grant insert (user_id, layout, prefs, updated_at) on public.user_room_state to authenticated;
grant update (user_id, layout, prefs, updated_at) on public.user_room_state to authenticated;

create or replace function public.kh_room_state_guard_owned()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Browser roles may never set or change `owned`; buy_room_item (definer)
  -- and service_role run as other roles and pass through.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.owned := '["character","plant"]'::jsonb;
    else
      new.owned := old.owned;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists kh_room_state_guard_owned on public.user_room_state;
create trigger kh_room_state_guard_owned
  before insert or update on public.user_room_state
  for each row execute function public.kh_room_state_guard_owned();

-- buy_room_item stays the only writer of `owned` (unchanged body; re-grant only).
revoke execute on function public.buy_room_item(text) from public, anon;
grant execute on function public.buy_room_item(text) to authenticated, service_role;

-- ── 3. prices ─────────────────────────────────────────────────────
update public.room_items r
   set price_nyang = v.new_price
  from (values
    ('poop', 3, 60), ('plant', 8, 100), ('cushion', 10, 120), ('lamp', 12, 140),
    ('plant_aloe', 12, 140), ('plant_pothos', 14, 170), ('jack_pumpkin', 14, 170),
    ('cat', 15, 180), ('aroma_diffuser', 16, 190), ('plant_lucky_bamboo', 16, 190),
    ('lava_lamp', 18, 220), ('cork_board', 18, 220), ('norigae', 18, 220),
    ('plant_snake', 18, 220), ('xmas_wreath', 18, 220),
    ('fennec', 20, 240), ('humidifier', 20, 240), ('map_korea', 20, 240), ('maedeup', 20, 240),
    ('bean_bag', 22, 260), ('string_lights', 22, 260),
    ('moon_lamp', 24, 290), ('whiteboard', 24, 290), ('plant_orchid', 24, 290), ('chuseok_lantern', 24, 290),
    ('bookshelf', 25, 300), ('jangdok', 25, 300), ('floor_lamp', 26, 310), ('wall_mirror', 28, 340),
    ('neon_hwaiting', 30, 360), ('espresso_machine', 32, 380), ('cat_white', 32, 380), ('cat_black', 32, 380),
    ('vinyl_player', 38, 460), ('corgi_dog', 38, 460), ('modern_desk', 42, 500),
    ('white_porcelain', 45, 540), ('recliner', 48, 580), ('celadon_vase', 48, 580),
    ('vanity_desk', 50, 600), ('xmas_tree', 50, 600), ('koi_pond', 52, 620),
    ('standing_desk', 55, 660), ('byobu', 55, 660), ('sofa_2seat', 60, 720),
    ('kotatsu', 65, 780), ('gaming_desk', 80, 960),
    ('theKIng', 500, 2400)
  ) as v(id, old_price, new_price)
 where r.id = v.id and r.price_nyang = v.old_price;
