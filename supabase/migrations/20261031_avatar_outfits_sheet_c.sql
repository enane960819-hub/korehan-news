-- auto-apply
-- My Room character: 3 more outfits (owner art, sheet C, 2026-10-31). Same catalogue as
-- 20261030_avatar_catalog.sql; only adds rows. Idempotent (re-run refreshes name / price /
-- goal / sort, keeps an admin's `active` choice).
-- Prices (owner delegated): doctor 400, K-pop stage 450 (the most wanted look); astronaut is a
-- study unlock (14-day streak), never sold.
insert into public.avatar_items (id, kind, name, price_nyang, sale_months, unlock_goal_key, unlock_goal_target, unlock_label, sort)
select v.id, v.kind, v.name, v.price, v.months, v.goal_key, v.goal_target, v.label, v.sort
  from (values
    ('av_outfit_doctor',    'outfit', 'Doctor',      400, null::smallint[], null, null::int, null, 195),
    ('av_outfit_kpop',      'outfit', 'K-pop stage', 450, null, null, null, null, 196),
    ('av_outfit_astronaut', 'outfit', 'Astronaut',   0,   null, 'streak_days', 14, 'Study 14 days in a row', 197)
  ) as v(id, kind, name, price, months, goal_key, goal_target, label, sort)
on conflict (id) do update
  set kind = excluded.kind, name = excluded.name, price_nyang = excluded.price_nyang,
      sale_months = excluded.sale_months, unlock_goal_key = excluded.unlock_goal_key,
      unlock_goal_target = excluded.unlock_goal_target, unlock_label = excluded.unlock_label,
      sort = excluded.sort;
