-- Published articles without a sentence-analysis cache (read-only).
-- Prod article_cache is the WIDE schema: one row per article_id, columns
-- translation / vocab / grammar / quiz (to_jsonb guards against drift).
with pub as (
  select id::text id, level, date::text d from public.articles where status = 'published'
), c as (
  select to_jsonb(t) j from public.article_cache t
), sc as (
  select j->>'article_id' id from c where coalesce(j->>'translation','') like '%sentences%'
), gr as (
  select j->>'article_id' id from c where coalesce(j->>'grammar','') like '%patterns%'
)
select json_build_object(
  'published', (select count(*) from pub),
  'cache_rows', (select count(*) from c),
  'cache_columns', (select json_agg(k) from (select jsonb_object_keys(j) k from c limit 30) x),
  'missing_sentences', (select count(*) from pub where id not in (select id from sc where id is not null)),
  'missing_grammar_tab', (select count(*) from pub where id not in (select id from gr where id is not null)),
  'missing_by_level', (select json_object_agg(coalesce(level,'?'), n) from (
      select level, count(*) n from pub where id not in (select id from sc where id is not null) group by level) x),
  'missing_by_month', (select json_object_agg(m, n) from (
      select left(d, 7) m, count(*) n from pub where id not in (select id from sc where id is not null) group by 1 order by 1) x)
) as report;
