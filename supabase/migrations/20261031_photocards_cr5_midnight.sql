-- auto-apply
-- Reporter photocards, set 1: Seo Do-yun (cr5) "Midnight" (owner art 2026-10-31).
-- Six digital cards (pc_cr5_s1_01..06), art in korehan/assets/photocards/cr5/.
-- preview[i] is the picture of items[i]: the reporter page card book reads it
-- to show owned cards and the locked ones still to collect.
-- Starts as a DRAFT (active = false): only the admin sees it and can test it
-- with "Admin test" in the Special sheet. It goes on sale when payments open.
-- Price $2.99 for 6 cards (IP plan, section 6). Card 01 is the open teaser (owner 2026-11-01): its
-- full picture is the public preview; the other five stay blurred until bought.
-- Idempotent; never flips active.

insert into public.cash_products (id, kind, name, description, price_cents, items, preview, image_url, reporter_id, badge, one_per_account, sort, active)
values (
  'pc_cr5_midnight', 'photocard_set', 'Midnight',
  'Seo Do-yun''s 1st photocard set. 6 digital cards for your card book.',
  299,
  array['pc_cr5_s1_01', 'pc_cr5_s1_02', 'pc_cr5_s1_03', 'pc_cr5_s1_04', 'pc_cr5_s1_05', 'pc_cr5_s1_06'],
  '[
    {"id": "pc_cr5_s1_01", "label": "Rooftop heart",   "img": "assets/photocards/cr5/e0ad8aa97715c0164584.webp", "open": true},
    {"id": "pc_cr5_s1_02", "label": "Night newsroom",  "img": "assets/photocards/cr5/s1-02-p.webp"},
    {"id": "pc_cr5_s1_03", "label": "Rainy street",    "img": "assets/photocards/cr5/s1-03-p.webp"},
    {"id": "pc_cr5_s1_04", "label": "Library",         "img": "assets/photocards/cr5/s1-04-p.webp"},
    {"id": "pc_cr5_s1_05", "label": "Last train",      "img": "assets/photocards/cr5/s1-05-p.webp"},
    {"id": "pc_cr5_s1_06", "label": "3 a.m. store",    "img": "assets/photocards/cr5/s1-06-p.webp"}
  ]'::jsonb,
  'assets/photocards/cr5/e0ad8aa97715c0164584.webp', 'cr5', '1ST SET', false, 50, false
)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,
  price_cents = excluded.price_cents, items = excluded.items, preview = excluded.preview, image_url = excluded.image_url,
  reporter_id = excluded.reporter_id, badge = excluded.badge, one_per_account = excluded.one_per_account, sort = excluded.sort;
