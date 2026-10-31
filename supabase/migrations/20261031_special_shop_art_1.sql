-- auto-apply
-- Special shop art, round 1 (owner's pictures, 2026-10-31): Christmas pack, starter pack and three
-- premium outfits. Items are cash_only (never sold for nyang); products start INACTIVE (drafts the
-- admin can preview in the Special tab) until card payments are tested. Text is base64 (Hangul-safe).
-- The fireplace's fire and the idol outfit's dance poses animate (KH_ROOM_FRAMES / outfit.frames).
-- Idempotent.
insert into public.room_items (id, name, price_nyang, image_url, base_size, sort_order, active, category, effect, shop_category, cash_only)
select v.* from (values
  ('xmas_fireplace', 'Christmas Fireplace', 0, 'assets/room/xmas-fireplace.png', 160, 3101, true, 'furniture', 'glow_warm', 'season', true),
  ('gingerbread_house', 'Gingerbread House', 0, 'assets/room/gingerbread-house.png', 90, 3102, true, 'deco', 'none', 'season', true),
  ('reindeer_plush', 'Reindeer Plush', 0, 'assets/room/reindeer-plush.png', 90, 3103, true, 'deco', 'none', 'plush', true),
  ('floor_cushions', 'Floor Cushions', 0, 'assets/room/floor-cushions.png', 120, 3104, true, 'furniture', 'none', 'furniture', true),
  ('mini_fridge', 'Mini Fridge', 0, 'assets/room/mini-fridge.png', 120, 3105, true, 'furniture', 'none', 'furniture', true),
  ('photo_strip', 'Photo Strip', 0, 'assets/room/photo-strip.png', 130, 3106, true, 'deco', 'none', 'wall', true)
) as v(id, name, price_nyang, image_url, base_size, sort_order, active, category, effect, shop_category, cash_only)
on conflict (id) do update set cash_only = true, image_url = excluded.image_url, effect = excluded.effect, shop_category = excluded.shop_category;

insert into public.avatar_items (id, kind, name, price_nyang, sort, cash_only)
select v.* from (values
  ('av_outfit_reindeer', 'outfit', 'Reindeer onesie', 0, 300, true),
  ('av_outfit_hoodie', 'outfit', 'Star hoodie', 0, 301, true),
  ('av_outfit_mhanbok', 'outfit', 'Modern hanbok', 0, 302, true),
  ('av_outfit_varsity', 'outfit', 'Varsity jacket', 0, 303, true),
  ('av_outfit_idol', 'outfit', 'Idol stage', 0, 304, true),
  ('av_room_christmas-room', 'room_theme', 'Christmas', 0, 310, true),
  ('av_room_han-river-room', 'room_theme', 'Han River', 0, 311, true)
) as v(id, kind, name, price_nyang, sort, cash_only)
on conflict (id) do update set cash_only = true;

do $$
declare r jsonb;
begin
  r := convert_from(decode('eyJpZCI6ICJ4bWFzX3BhY2tfMjAyNiIsICJraW5kIjogInBhY2siLCAibmFtZSI6ICJDaHJpc3RtYXMgUGFjayIsICJkZXNjcmlwdGlvbiI6ICJDaHJpc3RtYXMgcm9vbSB0aGVtZSwgcmVpbmRlZXIgb25lc2llLCBhIGZpcmVwbGFjZSB3aXRoIGEgbW92aW5nIGZpcmUsIGEgZ2luZ2VyYnJlYWQgaG91c2UgYW5kIGEgcmVpbmRlZXIgcGx1c2giLCAicHJpY2VfY2VudHMiOiA2OTksICJpdGVtcyI6IFsiYXZfcm9vbV9jaHJpc3RtYXMtcm9vbSIsICJhdl9vdXRmaXRfcmVpbmRlZXIiLCAieG1hc19maXJlcGxhY2UiLCAiZ2luZ2VyYnJlYWRfaG91c2UiLCAicmVpbmRlZXJfcGx1c2giXSwgInByZXZpZXciOiBbeyJsYWJlbCI6ICJDaHJpc3RtYXMgcm9vbSB0aGVtZSIsICJpbWciOiAiYXNzZXRzL3Jvb20vdGhlbWVzL2NocmlzdG1hcy1yb29tLndlYnAifSwgeyJsYWJlbCI6ICJSZWluZGVlciBvbmVzaWUiLCAiaW1nIjogImFzc2V0cy9hdmF0YXIvbG9uZy1yZWluZGVlci5wbmcifSwgeyJsYWJlbCI6ICJGaXJlcGxhY2UgKHRoZSBmaXJlIG1vdmVzKSIsICJpbWciOiAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UucG5nIiwgImZyYW1lcyI6IFsiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtMS5wbmciLCAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtMi5wbmciLCAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtMy5wbmciLCAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtNC5wbmciLCAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtNS5wbmciLCAiYXNzZXRzL3Jvb20veG1hcy1maXJlcGxhY2UtNi5wbmciXX0sIHsibGFiZWwiOiAiR2luZ2VyYnJlYWQgaG91c2UiLCAiaW1nIjogImFzc2V0cy9yb29tL2dpbmdlcmJyZWFkLWhvdXNlLnBuZyJ9LCB7ImxhYmVsIjogIlJlaW5kZWVyIHBsdXNoIiwgImltZyI6ICJhc3NldHMvcm9vbS9yZWluZGVlci1wbHVzaC5wbmcifV0sICJpbWFnZV91cmwiOiAiYXNzZXRzL3Jvb20vdGhlbWVzL2NocmlzdG1hcy1yb29tLndlYnAiLCAiYmFkZ2UiOiAiTElNSVRFRCIsICJvbmVfcGVyX2FjY291bnQiOiBmYWxzZSwgImVuZHNfYXQiOiAiMjAyNi0xMi0zMVQxNDo1OTo1OVoiLCAic29ydCI6IDEwfQ==', 'base64'), 'UTF8')::jsonb;
  insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, badge, one_per_account, ends_at, sort, active)
  values (r->>'id', r->>'kind', r->>'name', r->>'description', (r->>'price_cents')::int,
          array(select jsonb_array_elements_text(r->'items')), r->'preview', r->>'image_url', r->>'badge',
          (r->>'one_per_account')::boolean, (r->>'ends_at')::timestamptz, (r->>'sort')::int, false)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
     items = excluded.items, preview = excluded.preview, image_url = excluded.image_url, badge = excluded.badge,
     one_per_account = excluded.one_per_account, ends_at = excluded.ends_at, sort = excluded.sort;
  r := convert_from(decode('eyJpZCI6ICJzdGFydGVyX3BhY2siLCAia2luZCI6ICJzdGFydGVyIiwgIm5hbWUiOiAiU3RhcnRlciBQYWNrIiwgImRlc2NyaXB0aW9uIjogIkhhbiBSaXZlciByb29tIHRoZW1lLCBzdGFyIGhvb2RpZSwgZmxvb3IgY3VzaGlvbnMsIGEgbWluaSBmcmlkZ2UgYW5kIGEgcGhvdG8gc3RyaXAiLCAicHJpY2VfY2VudHMiOiA0OTksICJpdGVtcyI6IFsiYXZfcm9vbV9oYW4tcml2ZXItcm9vbSIsICJhdl9vdXRmaXRfaG9vZGllIiwgImZsb29yX2N1c2hpb25zIiwgIm1pbmlfZnJpZGdlIiwgInBob3RvX3N0cmlwIl0sICJwcmV2aWV3IjogW3sibGFiZWwiOiAiSGFuIFJpdmVyIHJvb20gdGhlbWUiLCAiaW1nIjogImFzc2V0cy9yb29tL3RoZW1lcy9oYW4tcml2ZXItcm9vbS53ZWJwIn0sIHsibGFiZWwiOiAiU3RhciBob29kaWUiLCAiaW1nIjogImFzc2V0cy9hdmF0YXIvbG9uZy1ob29kaWUucG5nIn0sIHsibGFiZWwiOiAiRmxvb3IgY3VzaGlvbnMiLCAiaW1nIjogImFzc2V0cy9yb29tL2Zsb29yLWN1c2hpb25zLnBuZyJ9LCB7ImxhYmVsIjogIk1pbmkgZnJpZGdlIiwgImltZyI6ICJhc3NldHMvcm9vbS9taW5pLWZyaWRnZS5wbmcifSwgeyJsYWJlbCI6ICJQaG90byBzdHJpcCIsICJpbWciOiAiYXNzZXRzL3Jvb20vcGhvdG8tc3RyaXAucG5nIn1dLCAiaW1hZ2VfdXJsIjogImFzc2V0cy9hdmF0YXIvbG9uZy1ob29kaWUucG5nIiwgImJhZGdlIjogbnVsbCwgIm9uZV9wZXJfYWNjb3VudCI6IHRydWUsICJlbmRzX2F0IjogbnVsbCwgInNvcnQiOiAyMH0=', 'base64'), 'UTF8')::jsonb;
  insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, badge, one_per_account, ends_at, sort, active)
  values (r->>'id', r->>'kind', r->>'name', r->>'description', (r->>'price_cents')::int,
          array(select jsonb_array_elements_text(r->'items')), r->'preview', r->>'image_url', r->>'badge',
          (r->>'one_per_account')::boolean, (r->>'ends_at')::timestamptz, (r->>'sort')::int, false)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
     items = excluded.items, preview = excluded.preview, image_url = excluded.image_url, badge = excluded.badge,
     one_per_account = excluded.one_per_account, ends_at = excluded.ends_at, sort = excluded.sort;
  r := convert_from(decode('eyJpZCI6ICJvdXRmaXRfaWRvbCIsICJraW5kIjogIm91dGZpdCIsICJuYW1lIjogIklkb2wgc3RhZ2UiLCAiZGVzY3JpcHRpb24iOiAiU2VxdWluIHN0YWdlIG91dGZpdC4gWW91ciBjaGFyYWN0ZXIgZGFuY2VzIHRocm91Z2ggOCBwb3NlcyBpbiB5b3VyIHJvb20uIiwgInByaWNlX2NlbnRzIjogNTk5LCAiaXRlbXMiOiBbImF2X291dGZpdF9pZG9sIl0sICJwcmV2aWV3IjogW3sibGFiZWwiOiAiSWRvbCBzdGFnZSAoZGFuY2UgcG9zZXMpIiwgImltZyI6ICJhc3NldHMvYXZhdGFyL2xvbmctaWRvbC0xLnBuZyIsICJmcmFtZXMiOiBbImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTEucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTIucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTMucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTQucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTUucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTYucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTcucG5nIiwgImFzc2V0cy9hdmF0YXIvbG9uZy1pZG9sLTgucG5nIl19LCB7ImxhYmVsIjogIkJvYiBoYWlyIiwgImltZyI6ICJhc3NldHMvYXZhdGFyL2JvYi1pZG9sLTEucG5nIiwgImZyYW1lcyI6IFsiYXNzZXRzL2F2YXRhci9ib2ItaWRvbC0xLnBuZyIsICJhc3NldHMvYXZhdGFyL2JvYi1pZG9sLTIucG5nIiwgImFzc2V0cy9hdmF0YXIvYm9iLWlkb2wtMy5wbmciLCAiYXNzZXRzL2F2YXRhci9ib2ItaWRvbC00LnBuZyIsICJhc3NldHMvYXZhdGFyL2JvYi1pZG9sLTUucG5nIiwgImFzc2V0cy9hdmF0YXIvYm9iLWlkb2wtNi5wbmciLCAiYXNzZXRzL2F2YXRhci9ib2ItaWRvbC03LnBuZyIsICJhc3NldHMvYXZhdGFyL2JvYi1pZG9sLTgucG5nIl19LCB7ImxhYmVsIjogIlNob3J0IGhhaXIiLCAiaW1nIjogImFzc2V0cy9hdmF0YXIvc2hvcnQtaWRvbC0xLnBuZyIsICJmcmFtZXMiOiBbImFzc2V0cy9hdmF0YXIvc2hvcnQtaWRvbC0xLnBuZyIsICJhc3NldHMvYXZhdGFyL3Nob3J0LWlkb2wtMi5wbmciLCAiYXNzZXRzL2F2YXRhci9zaG9ydC1pZG9sLTMucG5nIiwgImFzc2V0cy9hdmF0YXIvc2hvcnQtaWRvbC00LnBuZyIsICJhc3NldHMvYXZhdGFyL3Nob3J0LWlkb2wtNS5wbmciLCAiYXNzZXRzL2F2YXRhci9zaG9ydC1pZG9sLTYucG5nIiwgImFzc2V0cy9hdmF0YXIvc2hvcnQtaWRvbC03LnBuZyIsICJhc3NldHMvYXZhdGFyL3Nob3J0LWlkb2wtOC5wbmciXX0sIHsibGFiZWwiOiAiQ3VybHkgaGFpciIsICJpbWciOiAiYXNzZXRzL2F2YXRhci9jdXJseS1pZG9sLTEucG5nIiwgImZyYW1lcyI6IFsiYXNzZXRzL2F2YXRhci9jdXJseS1pZG9sLTEucG5nIiwgImFzc2V0cy9hdmF0YXIvY3VybHktaWRvbC0yLnBuZyIsICJhc3NldHMvYXZhdGFyL2N1cmx5LWlkb2wtMy5wbmciLCAiYXNzZXRzL2F2YXRhci9jdXJseS1pZG9sLTQucG5nIiwgImFzc2V0cy9hdmF0YXIvY3VybHktaWRvbC01LnBuZyIsICJhc3NldHMvYXZhdGFyL2N1cmx5LWlkb2wtNi5wbmciLCAiYXNzZXRzL2F2YXRhci9jdXJseS1pZG9sLTcucG5nIiwgImFzc2V0cy9hdmF0YXIvY3VybHktaWRvbC04LnBuZyJdfV0sICJpbWFnZV91cmwiOiAiYXNzZXRzL2F2YXRhci9sb25nLWlkb2wtMS5wbmciLCAiYmFkZ2UiOiAiTElNSVRFRCIsICJvbmVfcGVyX2FjY291bnQiOiBmYWxzZSwgImVuZHNfYXQiOiBudWxsLCAic29ydCI6IDMwfQ==', 'base64'), 'UTF8')::jsonb;
  insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, badge, one_per_account, ends_at, sort, active)
  values (r->>'id', r->>'kind', r->>'name', r->>'description', (r->>'price_cents')::int,
          array(select jsonb_array_elements_text(r->'items')), r->'preview', r->>'image_url', r->>'badge',
          (r->>'one_per_account')::boolean, (r->>'ends_at')::timestamptz, (r->>'sort')::int, false)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
     items = excluded.items, preview = excluded.preview, image_url = excluded.image_url, badge = excluded.badge,
     one_per_account = excluded.one_per_account, ends_at = excluded.ends_at, sort = excluded.sort;
  r := convert_from(decode('eyJpZCI6ICJvdXRmaXRfbWhhbmJvayIsICJraW5kIjogIm91dGZpdCIsICJuYW1lIjogIk1vZGVybiBoYW5ib2siLCAiZGVzY3JpcHRpb24iOiAiRXZlcnlkYXkgbW9kZXJuIGhhbmJvay4iLCAicHJpY2VfY2VudHMiOiAzOTksICJpdGVtcyI6IFsiYXZfb3V0Zml0X21oYW5ib2siXSwgInByZXZpZXciOiBbeyJsYWJlbCI6ICJNb2Rlcm4gaGFuYm9rIiwgImltZyI6ICJhc3NldHMvYXZhdGFyL2xvbmctbWhhbmJvay5wbmcifSwgeyJsYWJlbCI6ICJTaG9ydCBoYWlyIiwgImltZyI6ICJhc3NldHMvYXZhdGFyL3Nob3J0LW1oYW5ib2sucG5nIn1dLCAiaW1hZ2VfdXJsIjogImFzc2V0cy9hdmF0YXIvbG9uZy1taGFuYm9rLnBuZyIsICJiYWRnZSI6IG51bGwsICJvbmVfcGVyX2FjY291bnQiOiBmYWxzZSwgImVuZHNfYXQiOiBudWxsLCAic29ydCI6IDMxfQ==', 'base64'), 'UTF8')::jsonb;
  insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, badge, one_per_account, ends_at, sort, active)
  values (r->>'id', r->>'kind', r->>'name', r->>'description', (r->>'price_cents')::int,
          array(select jsonb_array_elements_text(r->'items')), r->'preview', r->>'image_url', r->>'badge',
          (r->>'one_per_account')::boolean, (r->>'ends_at')::timestamptz, (r->>'sort')::int, false)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
     items = excluded.items, preview = excluded.preview, image_url = excluded.image_url, badge = excluded.badge,
     one_per_account = excluded.one_per_account, ends_at = excluded.ends_at, sort = excluded.sort;
  r := convert_from(decode('eyJpZCI6ICJvdXRmaXRfdmFyc2l0eSIsICJraW5kIjogIm91dGZpdCIsICJuYW1lIjogIlZhcnNpdHkgamFja2V0IiwgImRlc2NyaXB0aW9uIjogIk5hdnkgYW5kIGNyZWFtIHZhcnNpdHkgamFja2V0IHdpdGggYSBzdGFyIHBhdGNoLiIsICJwcmljZV9jZW50cyI6IDM5OSwgIml0ZW1zIjogWyJhdl9vdXRmaXRfdmFyc2l0eSJdLCAicHJldmlldyI6IFt7ImxhYmVsIjogIlZhcnNpdHkgamFja2V0IiwgImltZyI6ICJhc3NldHMvYXZhdGFyL2xvbmctdmFyc2l0eS5wbmcifSwgeyJsYWJlbCI6ICJTaG9ydCBoYWlyIiwgImltZyI6ICJhc3NldHMvYXZhdGFyL3Nob3J0LXZhcnNpdHkucG5nIn1dLCAiaW1hZ2VfdXJsIjogImFzc2V0cy9hdmF0YXIvbG9uZy12YXJzaXR5LnBuZyIsICJiYWRnZSI6IG51bGwsICJvbmVfcGVyX2FjY291bnQiOiBmYWxzZSwgImVuZHNfYXQiOiBudWxsLCAic29ydCI6IDMyfQ==', 'base64'), 'UTF8')::jsonb;
  insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, badge, one_per_account, ends_at, sort, active)
  values (r->>'id', r->>'kind', r->>'name', r->>'description', (r->>'price_cents')::int,
          array(select jsonb_array_elements_text(r->'items')), r->'preview', r->>'image_url', r->>'badge',
          (r->>'one_per_account')::boolean, (r->>'ends_at')::timestamptz, (r->>'sort')::int, false)
  on conflict (id) do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
     items = excluded.items, preview = excluded.preview, image_url = excluded.image_url, badge = excluded.badge,
     one_per_account = excluded.one_per_account, ends_at = excluded.ends_at, sort = excluded.sort;
end $$;
