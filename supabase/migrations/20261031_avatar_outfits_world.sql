-- auto-apply
-- My Room character: 9 more outfits (owner art, sheets A / B / D, 2026-10-31).
-- Same catalogue as 20261030_avatar_catalog.sql (read its header); this only
-- adds rows. Idempotent: a re-run refreshes name / price / season / goal / sort
-- and keeps an admin's `active` choice.
-- Prices (owner delegated): both hijab looks are free so every learner can
-- dress like themselves; cowboy / ao dai 400, chef 350; winter padding 350
-- on sale Nov–Feb, Christmas 350 in December; taekwondo (20 games) and
-- graduation (30 real articles read) are study unlocks, never sold —
-- kh_claim_room_unlocks grants them from avatar_items goals as it does hanbok.
insert into public.avatar_items (id, kind, name, price_nyang, sale_months, unlock_goal_key, unlock_goal_target, unlock_label, sort)
select v.id, v.kind, v.name, v.price, v.months, v.goal_key, v.goal_target, v.label, v.sort
  from (values
    ('av_outfit_hijab',       'outfit', 'Hijab',          0,   null::smallint[], null, null::int, null, 110),
    ('av_outfit_hijab-sport', 'outfit', 'Sport hijab',    0,   null, null, null, null, 120),
    ('av_outfit_cowboy',      'outfit', 'Cowboy',         400, null, null, null, null, 130),
    ('av_outfit_aodai',       'outfit', 'Ao dai',         400, null, null, null, null, 140),
    ('av_outfit_chef',        'outfit', 'Chef',           350, null, null, null, null, 150),
    ('av_outfit_taekwondo',   'outfit', 'Taekwondo',      0,   null, 'games_played', 20, 'Finish 20 games', 160),
    ('av_outfit_graduation',  'outfit', 'Graduation',     0,   null, 'articles_read', 30, 'Read 30 articles', 170),
    ('av_outfit_padding',     'outfit', 'Winter padding', 350, array[11, 12, 1, 2]::smallint[], null, null, null, 180),
    ('av_outfit_christmas',   'outfit', 'Christmas',      350, array[12]::smallint[], null, null, null, 190)
  ) as v(id, kind, name, price, months, goal_key, goal_target, label, sort)
on conflict (id) do update
  set kind = excluded.kind, name = excluded.name, price_nyang = excluded.price_nyang,
      sale_months = excluded.sale_months, unlock_goal_key = excluded.unlock_goal_key,
      unlock_goal_target = excluded.unlock_goal_target, unlock_label = excluded.unlock_label,
      sort = excluded.sort;
