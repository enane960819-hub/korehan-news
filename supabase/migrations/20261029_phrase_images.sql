-- auto-apply
-- Today's Phrase banner images: public read, admin-only write. The phrase
-- row (app_settings.phrases[i].image) stores the public URL.
insert into storage.buckets (id, name, public) values ('phrase-images', 'phrase-images', true)
on conflict (id) do nothing;
drop policy if exists "phrase_images_admin_insert" on storage.objects;
create policy "phrase_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'phrase-images' and public.is_admin_email());
drop policy if exists "phrase_images_admin_update" on storage.objects;
create policy "phrase_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'phrase-images' and public.is_admin_email());
drop policy if exists "phrase_images_admin_delete" on storage.objects;
create policy "phrase_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'phrase-images' and public.is_admin_email());
