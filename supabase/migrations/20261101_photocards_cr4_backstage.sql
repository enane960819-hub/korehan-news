-- auto-apply
-- Reporter photocards, set 1: Alicia (cr4) "Backstage" (owner art 2026-11-01).
-- Six digital cards (pc_cr4_s1_01..06), art in korehan/assets/photocards/cr4/; preview[i] is
-- the picture of items[i] (the reporter page card book reads it). Starts as a DRAFT
-- (active = false) like the Seo Do-yun set; on sale when payments open. $2.99 for 6 cards.
-- Idempotent; never flips active.

insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, reporter_id, badge, one_per_account, sort, active)
values (
  'pc_cr4_backstage', 'photocard_set', 'Backstage',
  'Alicia''s 1st photocard set. 6 digital cards for your card book.',
  299,
  array['pc_cr4_s1_01', 'pc_cr4_s1_02', 'pc_cr4_s1_03', 'pc_cr4_s1_04', 'pc_cr4_s1_05', 'pc_cr4_s1_06'],
  '[
    {"id": "pc_cr4_s1_01", "label": "Recording booth", "img": "assets/photocards/cr4/s1-01-p.webp"},
    {"id": "pc_cr4_s1_02", "label": "Night street",    "img": "assets/photocards/cr4/s1-02-p.webp"},
    {"id": "pc_cr4_s1_03", "label": "Tteokbokki stop", "img": "assets/photocards/cr4/s1-03-p.webp"},
    {"id": "pc_cr4_s1_04", "label": "Concert V",       "img": "assets/photocards/cr4/s1-04-p.webp"},
    {"id": "pc_cr4_s1_05", "label": "Photo booth",     "img": "assets/photocards/cr4/s1-05-p.webp"},
    {"id": "pc_cr4_s1_06", "label": "Before the stage","img": "assets/photocards/cr4/s1-06-p.webp"}
  ]'::jsonb,
  'assets/photocards/cr4/s1-04-p.webp', 'cr4', '1ST SET', false, 51, false
)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,
  price_cents = excluded.price_cents, items = excluded.items, preview = excluded.preview, image_url = excluded.image_url,
  reporter_id = excluded.reporter_id, badge = excluded.badge, one_per_account = excluded.one_per_account, sort = excluded.sort;
