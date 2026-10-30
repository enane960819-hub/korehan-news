-- auto-apply
-- One streak everywhere (2026-10-30 sweep): user_stats.streak is written by the browser and
-- went stale (QA account: stored 4, real 7), so My Page / Progress / profiles disagreed with
-- Home. The real streak is consecutive KST days with any daily_missions activity, counting
-- from today (or yesterday when nothing is logged yet today) — same rule as
-- fetchActivityStreakFromDB() in js/features/daily-mission.js. Pages read it for the signed-in
-- learner directly; other people's profiles call this function (they can't read another
-- learner's daily_missions). Signed-in only, like user_stats.
create or replace function public.kh_user_streak(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with today as (select (now() at time zone 'Asia/Seoul')::date as d),
  days as (
    select distinct m.date::date as d
      from public.daily_missions m, today t
     where m.user_id = p_user
       and coalesce(m.articles, 0) + coalesce(m.words, 0) + coalesce(m.quizzes, 0) + coalesce(m.fill, 0) > 0
       and m.date::date between t.d - 400 and t.d
  ),
  start as (
    select case when exists (select 1 from days, today where days.d = today.d)
                then (select d from today) else (select d - 1 from today) end as s
  ),
  ranked as (
    select days.d, row_number() over (order by days.d desc) as rn
      from days, start where days.d <= start.s
  )
  select count(*)::int from ranked, start where ranked.d = start.s - (ranked.rn - 1)::int;
$$;

revoke all on function public.kh_user_streak(uuid) from public;
revoke all on function public.kh_user_streak(uuid) from anon;
grant execute on function public.kh_user_streak(uuid) to authenticated;
