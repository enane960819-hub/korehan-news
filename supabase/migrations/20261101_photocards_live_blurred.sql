-- auto-apply
-- Photocards on sale before payments open (owner 2026-11-01): the sets are listed, but a card
-- is only seen in full once it's yours. Everyone sees the blurred preview
-- (cash_products.preview -> assets/photocards/<reporter>/s1-NN-p.webp); the full picture's
-- address lives in photocard_art, readable only by someone who owns that card (user_photocards,
-- server-written on purchase / admin test grant) or the admin. Full pictures have random file
-- names so they can't be guessed from the preview names.
-- Buying still shows "Card payments are being set up" until Stripe is configured.
-- Idempotent.

create table if not exists public.photocard_art (
  card_id    text primary key check (card_id ~ '^pc_[a-z0-9_]+$'),
  product_id text not null references public.cash_products(id) on delete cascade,
  img        text not null
);
alter table public.photocard_art enable row level security;
drop policy if exists photocard_art_owner_read on public.photocard_art;
create policy photocard_art_owner_read on public.photocard_art for select
  using (coalesce(public.is_admin_email(), false)
         or exists (select 1 from public.user_photocards u where u.user_id = auth.uid() and u.card_id = photocard_art.card_id));
revoke all on public.photocard_art from anon, authenticated;
grant select on public.photocard_art to authenticated;

insert into public.photocard_art (card_id, product_id, img) values
  ('pc_cr4_s1_01', 'pc_cr4_backstage', 'assets/photocards/cr4/21fab5c4ca420ba3f6a0.webp'),
  ('pc_cr4_s1_02', 'pc_cr4_backstage', 'assets/photocards/cr4/84dcc3481c6396075f8a.webp'),
  ('pc_cr4_s1_03', 'pc_cr4_backstage', 'assets/photocards/cr4/3dc29756620728e6021e.webp'),
  ('pc_cr4_s1_04', 'pc_cr4_backstage', 'assets/photocards/cr4/93954824c6721103de22.webp'),
  ('pc_cr4_s1_05', 'pc_cr4_backstage', 'assets/photocards/cr4/4519e918b3d4d7ded7a1.webp'),
  ('pc_cr4_s1_06', 'pc_cr4_backstage', 'assets/photocards/cr4/fbd625c416a4d2611bbb.webp'),
  ('pc_cr5_s1_01', 'pc_cr5_midnight', 'assets/photocards/cr5/e0ad8aa97715c0164584.webp'),
  ('pc_cr5_s1_02', 'pc_cr5_midnight', 'assets/photocards/cr5/b51254e3818175209ed9.webp'),
  ('pc_cr5_s1_03', 'pc_cr5_midnight', 'assets/photocards/cr5/b5a35b575512bad64f3a.webp'),
  ('pc_cr5_s1_04', 'pc_cr5_midnight', 'assets/photocards/cr5/770077e6961321ce879d.webp'),
  ('pc_cr5_s1_05', 'pc_cr5_midnight', 'assets/photocards/cr5/533bdc258f028c135256.webp'),
  ('pc_cr5_s1_06', 'pc_cr5_midnight', 'assets/photocards/cr5/6300087c0d3dfbb9f1ec.webp')
on conflict (card_id) do update set product_id = excluded.product_id, img = excluded.img;

-- The first two sets go on the shelf (blurred until bought).
update public.cash_products set active = true where id in ('pc_cr5_midnight', 'pc_cr4_backstage') and not active;
