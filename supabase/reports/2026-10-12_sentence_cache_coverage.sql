-- Published articles without a sentence-analysis cache (read-only).
with pub as (
  select id, level, date, title from public.articles where status = 'published'
), sc as (
  select content_id from public.article_cache
   where content_type = 'article' and cache_key = 'translation'
     and cache_value like '%"sentences"%'
)
select json_build_object(
  'published', (select count(*) from pub),
  'missing', (select count(*) from pub where id::text not in (select content_id from sc)),
  'missing_by_level', (select json_object_agg(coalesce(level,'?'), n) from (
      select level, count(*) n from pub where id::text not in (select content_id from sc) group by level) x),
  'missing_by_month', (select json_object_agg(m, n) from (
      select left(date::text, 7) m, count(*) n from pub where id::text not in (select content_id from sc) group by 1 order by 1) x),
  'nosj_example', (select json_agg(title) from (select title from pub where id::text not in (select content_id from sc) and title like '%낫싱%' limit 1) x)
) as report;
