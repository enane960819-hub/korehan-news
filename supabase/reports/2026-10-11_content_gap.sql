-- Content gap snapshot (read-only): when did each content type last get
-- published, monthly output, and learner activity. to_jsonb() keeps it
-- immune to column-name drift.
with a as (select to_jsonb(t) j from public.articles t),
s as (select to_jsonb(t) j from public.stories_data t),
c as (select to_jsonb(t) j from public.conversations_data t)
select json_build_object(
  'articles', json_build_object(
    'total', (select count(*) from a),
    'by_status', (select json_object_agg(st, n) from (select coalesce(j->>'status','?') st, count(*) n from a group by 1) x),
    'last_published_date', (select max(j->>'date') from a where coalesce(j->>'status','published') = 'published'),
    'published_by_month', (select json_object_agg(m, n) from (
        select left(j->>'date', 7) m, count(*) n from a
         where coalesce(j->>'status','published') = 'published' and j->>'date' >= '2025-10'
         group by 1 order by 1) x),
    'published_by_level', (select json_object_agg(l, n) from (
        select coalesce(j->>'level','?') l, count(*) n from a where coalesce(j->>'status','published') = 'published' group by 1) x)
  ),
  'stories', json_build_object('total', (select count(*) from s),
    'last_created', (select max(coalesce(j->>'created_at', j->>'date')) from s)),
  'conversations', json_build_object('total', (select count(*) from c),
    'last_created', (select max(coalesce(j->>'created_at', j->>'date')) from c)),
  'signups_by_month', (select json_object_agg(m, n) from (
      select to_char(created_at, 'YYYY-MM') m, count(*) n from auth.users
       where created_at >= '2025-10-01' group by 1 order by 1) x),
  'users_total', (select count(*) from auth.users),
  'active_users_by_month', (select json_object_agg(m, n) from (
      select to_char(last_sign_in_at, 'YYYY-MM') m, count(*) n from auth.users
       where last_sign_in_at >= '2025-10-01' group by 1 order by 1) x)
) as report;
