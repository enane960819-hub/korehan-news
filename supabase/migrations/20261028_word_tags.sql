-- auto-apply
-- Word Universe categories. vocabulary_bank.interest_tag was empty for every
-- row, so the Universe guessed categories from prefix rules and filed words
-- like 회사 under Drama. content-qa now tags each word once (bank words and
-- words learners saved) into this table; the Universe reads it. Read-only
-- for clients, written by the service role.
create table if not exists public.word_tags (
  word_ko    text primary key,
  tag        text not null check (tag in ('daily','food','places','people','work','society','culture','nature','study')),
  updated_at timestamptz not null default now()
);
alter table public.word_tags enable row level security;
drop policy if exists word_tags_read on public.word_tags;
create policy word_tags_read on public.word_tags for select using (true);

-- Words that still need a tag: the active vocabulary bank first, then words
-- learners saved that aren't in the bank. Service role only (the function
-- reads it; no user ids leave the database). vocabulary_bank.interest_tag is
-- left alone — other features use it for learner interests.
drop function if exists public.untagged_saved_words(int);
create or replace function public.untagged_words(p_limit int)
returns table(word_ko text, word_en text)
language sql stable security definer set search_path = public as $$
  (select v.word_ko, max(v.word_en)
     from public.vocabulary_bank v
    where v.is_active and coalesce(v.word_ko, '') <> ''
      and not exists (select 1 from public.word_tags t where t.word_ko = v.word_ko)
    group by v.word_ko
    order by v.word_ko
    limit p_limit)
  union all
  (select s.word_ko, max(s.word_en)
     from public.user_saved_words s
    where coalesce(s.word_ko, '') <> ''
      and not exists (select 1 from public.word_tags t where t.word_ko = s.word_ko)
      and not exists (select 1 from public.vocabulary_bank v where v.is_active and v.word_ko = s.word_ko)
    group by s.word_ko
    order by s.word_ko
    limit p_limit)
  limit p_limit;
$$;
revoke all on function public.untagged_words(int) from public, anon, authenticated;
grant execute on function public.untagged_words(int) to service_role;
