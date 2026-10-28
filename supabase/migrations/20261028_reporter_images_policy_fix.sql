-- auto-apply
-- reporter_post_images still had two old permissive policies that let ANY
-- signed-in user insert or delete images on anyone's post (policies OR
-- together, so the strict *_manageable_post ones didn't help). Keep only the
-- author-or-admin policies. Idempotent.
drop policy if exists "Authenticated users can delete images" on public.reporter_post_images;
drop policy if exists "Authenticated users can insert images" on public.reporter_post_images;
-- Same cleanup for reporter_posts: the strict owner-or-admin policies cover
-- these older duplicates.
drop policy if exists "Authors can delete posts" on public.reporter_posts;
drop policy if exists "Authors can insert posts" on public.reporter_posts;
drop policy if exists "Authors can update posts" on public.reporter_posts;
