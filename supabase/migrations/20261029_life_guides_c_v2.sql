-- auto-apply
-- Life in Korea v2 (mockup L): extra = facts / checklist / tips / warn /
-- items / places / offices flag (seeded from scripts/life-guides);
-- photos = [{url, caption, credit}] added by the admin from the guide page.
alter table public.life_guides
  add column if not exists extra jsonb not null default '{}'::jsonb,
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- Photos bucket: public read, admin-only write.
insert into storage.buckets (id, name, public) values ('life-photos', 'life-photos', true)
on conflict (id) do nothing;
drop policy if exists "life_photos_admin_insert" on storage.objects;
create policy "life_photos_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'life-photos' and public.is_admin_email());
drop policy if exists "life_photos_admin_update" on storage.objects;
create policy "life_photos_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'life-photos' and public.is_admin_email());
drop policy if exists "life_photos_admin_delete" on storage.objects;
create policy "life_photos_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'life-photos' and public.is_admin_email());
