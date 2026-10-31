-- auto-apply
-- Instagram-style reporter page (owner-approved mockup 2026-10-31).
--
-- 1. Security: reporter_posts accepted inserts from ANY signed-in user (policy
--    "auth.uid() = author_user_id or admin"), so anyone could post on a
--    reporter's feed. Reporters are run by the admin: posts are admin-write only.
-- 2. A post is also a small lesson: caption_en (translation), vocab
--    [{ko, en}] (tappable words in the caption) and quiz {q, a, w: [wrong...]}.
--    Written by the admin by hand (not AI), so it is not in the content-qa queue.
-- 3. Follows and likes: one row per learner (own-row RLS). Counts come from
--    kh_reporter_feed_stats() so nobody reads other people's rows.
--    Comments reuse the article comments table (article_id 'rpost:<post id>')
--    with submit_comment's cooldown / length checks and the report flow.
-- Idempotent.

alter table public.reporter_posts add column if not exists caption_en text;
alter table public.reporter_posts add column if not exists vocab jsonb not null default '[]'::jsonb;
alter table public.reporter_posts add column if not exists quiz jsonb;

drop policy if exists reporter_posts_insert_owner_or_admin on public.reporter_posts;
drop policy if exists reporter_posts_update_owner_or_admin on public.reporter_posts;
drop policy if exists reporter_posts_delete_owner_or_admin on public.reporter_posts;
drop policy if exists reporter_posts_insert_admin on public.reporter_posts;
drop policy if exists reporter_posts_update_admin on public.reporter_posts;
drop policy if exists reporter_posts_delete_admin on public.reporter_posts;
create policy reporter_posts_insert_admin on public.reporter_posts for insert with check (public.is_admin_email());
create policy reporter_posts_update_admin on public.reporter_posts for update using (public.is_admin_email()) with check (public.is_admin_email());
create policy reporter_posts_delete_admin on public.reporter_posts for delete using (public.is_admin_email());

create table if not exists public.reporter_follows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  reporter_id text not null check (reporter_id ~ '^cr[0-9]{1,3}$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, reporter_id)
);
alter table public.reporter_follows enable row level security;
drop policy if exists reporter_follows_own on public.reporter_follows;
create policy reporter_follows_own on public.reporter_follows for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.reporter_follows from anon;
grant select, insert, delete on public.reporter_follows to authenticated;

create table if not exists public.reporter_post_likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references public.reporter_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.reporter_post_likes enable row level security;
drop policy if exists reporter_post_likes_own on public.reporter_post_likes;
create policy reporter_post_likes_own on public.reporter_post_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.reporter_post_likes from anon;
grant select, insert, delete on public.reporter_post_likes to authenticated;

-- Followers, my follow, and per published post: likes, comments, whether I liked it.
create or replace function public.kh_reporter_feed_stats(p_reporter text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with posts as (
    select id from public.reporter_posts where reporter_id = p_reporter and status = 'published'
  )
  select jsonb_build_object(
    'followers', (select count(*) from public.reporter_follows where reporter_id = p_reporter),
    'following', exists (select 1 from public.reporter_follows where reporter_id = p_reporter and user_id = auth.uid()),
    'likes', coalesce((select jsonb_object_agg(l.post_id, l.n) from (
        select post_id, count(*) n from public.reporter_post_likes where post_id in (select id from posts) group by post_id) l), '{}'::jsonb),
    'liked', coalesce((select jsonb_agg(post_id) from public.reporter_post_likes
        where user_id = auth.uid() and post_id in (select id from posts)), '[]'::jsonb),
    'comments', coalesce((select jsonb_object_agg(c.k, c.n) from (
        select substr(cm.article_id, 7) k, count(*) n from public.comments cm
         where cm.article_id in (select 'rpost:' || id::text from posts)
           and coalesce(to_jsonb(cm) ->> 'deleted_at', '') = ''
         group by cm.article_id) c), '{}'::jsonb)
  );
$function$;
revoke all on function public.kh_reporter_feed_stats(text) from public;
grant execute on function public.kh_reporter_feed_stats(text) to anon, authenticated;
