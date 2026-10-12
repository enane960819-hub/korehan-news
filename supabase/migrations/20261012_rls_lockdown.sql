-- auto-apply
-- SECURITY (A1–A3, owner-approved 2026-10-12 after a live audit).
-- Anonymous visitors could read, edit and delete other users' data (all
-- user_saved_words rows were readable) and rewrite site content. Edge
-- functions / admin-api use the service role and bypass RLS, so they are
-- unaffected. Admin edits made from the CMS with the admin's own session keep
-- working via is_admin_email().

-- ── A1. Per-user data: owner only (+ admin read) ─────────────────────
drop policy if exists usw_select on public.user_saved_words;
drop policy if exists usw_insert on public.user_saved_words;
drop policy if exists usw_update on public.user_saved_words;
drop policy if exists usw_delete on public.user_saved_words;
drop policy if exists usw_own_select on public.user_saved_words;
drop policy if exists usw_own_insert on public.user_saved_words;
drop policy if exists usw_own_update on public.user_saved_words;
drop policy if exists usw_own_delete on public.user_saved_words;
create policy usw_own_select on public.user_saved_words for select using (auth.uid() = user_id or public.is_admin_email());
create policy usw_own_insert on public.user_saved_words for insert with check (auth.uid() = user_id);
create policy usw_own_update on public.user_saved_words for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy usw_own_delete on public.user_saved_words for delete using (auth.uid() = user_id);

drop policy if exists article_study_select on public.article_study_submissions;
drop policy if exists article_study_own_select on public.article_study_submissions;
create policy article_study_own_select on public.article_study_submissions
  for select using (auth.uid() = user_id or public.is_admin_email());

drop policy if exists "service all" on public.user_topic_history;
drop policy if exists uth_own on public.user_topic_history;
create policy uth_own on public.user_topic_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Subscriber emails / raw page views: admin only (admin-api uses service role).
drop policy if exists "read own sub" on public.newsletter_subs;
drop policy if exists "anon read page_views" on public.page_views;
drop policy if exists "admin read page_views" on public.page_views;
create policy "admin read page_views" on public.page_views for select using (public.is_admin_email());

-- XP: a user may only log XP for themselves.
drop policy if exists "xp_log service insert" on public.xp_log;
drop policy if exists "xp_log own insert" on public.xp_log;
create policy "xp_log own insert" on public.xp_log for insert with check (auth.uid() = user_id);

-- ── A2. Site content: admin writes only ──────────────────────────────
-- Shared AI caches stay writable by signed-in users (readers' devices fill
-- them), but no longer by anonymous visitors.
drop policy if exists "service write" on public.article_cache;
drop policy if exists "service update" on public.article_cache;
drop policy if exists "article_cache auth write" on public.article_cache;
drop policy if exists "article_cache auth update" on public.article_cache;
create policy "article_cache auth write" on public.article_cache
  for insert with check (auth.role() = 'authenticated');
create policy "article_cache auth update" on public.article_cache
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists service_write on public.article_study_content;
drop policy if exists asc_auth_write on public.article_study_content;
create policy asc_auth_write on public.article_study_content
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Pure content tables: drop the open write policies, admin-only writes.
drop policy if exists service_write on public.character_reporters;
drop policy if exists "conversations_data public update ctx_en" on public.conversations_data;
drop policy if exists "public insert convs" on public.conversations_data;
drop policy if exists "public insert stories" on public.stories_data;
drop policy if exists "stories_data public update title_en" on public.stories_data;
drop policy if exists picture_prompts_write_all on public.study_picture_prompts;
drop policy if exists grammar_write_all on public.study_room_grammar;
drop policy if exists helpers_write_all on public.study_room_helpers;
drop policy if exists "service write vocab" on public.vocab_overrides;
drop policy if exists "service update vocab" on public.vocab_overrides;
drop policy if exists "service delete vocab" on public.vocab_overrides;
drop policy if exists "service write topics" on public.writing_topics;
drop policy if exists "service update topics" on public.writing_topics;
drop policy if exists "service delete topics" on public.writing_topics;
drop policy if exists hover_vocab_auth_insert on public.hover_vocab_master;
drop policy if exists hover_vocab_auth_update on public.hover_vocab_master;
drop policy if exists hover_vocab_auth_delete on public.hover_vocab_master;

do $$
declare t text;
begin
  foreach t in array array['character_reporters','conversations_data','stories_data','study_picture_prompts',
                           'study_room_grammar','study_room_helpers','vocab_overrides','writing_topics','hover_vocab_master']
  loop
    execute format('drop policy if exists %I on public.%I', t || ' admin write', t);
    execute format('create policy %I on public.%I for all using (public.is_admin_email()) with check (public.is_admin_email())',
                   t || ' admin write', t);
  end loop;
end $$;

-- ── A3. Storage: no more "anyone can upload anywhere" ───────────────
drop policy if exists "upload 15k2zms_0" on storage.objects;
drop policy if exists "kh admin storage write" on storage.objects;
create policy "kh admin storage write" on storage.objects for all to authenticated
  using (public.is_admin_email()) with check (public.is_admin_email());
-- Learners upload only their own avatar: avatars/<uid>/...
drop policy if exists "avatars own write" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
