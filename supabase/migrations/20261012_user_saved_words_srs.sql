-- auto-apply
-- D2: every save goes to user_saved_words, but the Word Book SRS screens
-- (Learn page banner, Study Room review queue, My Page list) read the dead
-- saved_words table — so reviews were always "all caught up" / empty.
-- Give user_saved_words the SRS columns and point the RPC at it.
-- New words become due the next day (next-day review loop); existing words
-- are due today.

alter table public.user_saved_words
  add column if not exists srs_interval      int     not null default 1,
  add column if not exists srs_ease_factor   numeric not null default 2.5,
  add column if not exists srs_next_review   date    default ((now() at time zone 'Asia/Seoul')::date + 1),
  add column if not exists srs_last_reviewed timestamptz,
  add column if not exists srs_review_count  int     not null default 0;

update public.user_saved_words
   set srs_next_review = (now() at time zone 'Asia/Seoul')::date
 where srs_next_review is null or srs_next_review > (now() at time zone 'Asia/Seoul')::date + 1;

create index if not exists idx_usw_srs_due on public.user_saved_words (user_id, srs_next_review);

create or replace function public.increment_srs_review_count(p_user_id uuid, p_word_ko text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.user_saved_words
     set srs_review_count = coalesce(srs_review_count, 0) + 1
   where user_id = p_user_id and p_user_id = auth.uid() and word_ko = p_word_ko;
$$;
revoke execute on function public.increment_srs_review_count(uuid, text) from public;
grant  execute on function public.increment_srs_review_count(uuid, text) to authenticated;
