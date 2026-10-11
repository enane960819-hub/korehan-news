-- auto-apply
-- Korea Buzz — daily original article about what Korean online communities
-- are talking about (built by daily-article-draft/buzz.ts as a draft).
-- 1. sections row 'buzz' (News dropdown + korehan-section.html?s=buzz)
-- 2. articles.netizen_talk jsonb: { summary_en, reactions[{ko,en}],
--    slang[{term,meaning,example_ko,example_en}] } — paraphrased, never quoted.
-- 3. Drop the one-off source probe table (its job is done).

alter table public.articles add column if not exists netizen_talk jsonb;

insert into public.sections (key, label, icon, sort_order, active)
values ('buzz', 'Korea Buzz', '🔥', 2, true)
on conflict (key) do update
set label = excluded.label, icon = excluded.icon, sort_order = excluded.sort_order, active = true;

drop table if exists public.buzz_source_probe;
