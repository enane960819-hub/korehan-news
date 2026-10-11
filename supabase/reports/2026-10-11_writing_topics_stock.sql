-- writing_topics stock / duplicate check (read-only).
with t as (
  select level, topic_ko, topic_en, category, active, sort_order, created_at,
         regexp_replace(lower(topic_ko), '[^가-힣a-z0-9]', '', 'g') as norm
    from public.writing_topics
), act as (select * from t where active),
cnt as (select level, count(*) n from act group by level),
days as (select floor(extract(epoch from (now() - timestamptz '2026-04-15 00:00:00+09')) / 86400)::int d)
select json_build_object(
  'days_since_epoch', (select d from days),
  'per_level', (select json_agg(json_build_object(
      'level', c.level, 'active', c.n,
      'inactive', (select count(*) from t where t.level = c.level and not t.active),
      'today_index', (select d from days) % c.n,
      'cycles_completed', (select d from days) / c.n,
      'days_until_wrap', c.n - ((select d from days) % c.n),
      'distinct_norm', (select count(distinct norm) from act a where a.level = c.level)
    ) order by c.level) from cnt c),
  'dupes_within_level', (select coalesce(json_agg(x), '[]'::json) from (
      select level, min(topic_ko) as example, count(*) as copies
        from act group by level, norm having count(*) > 1 order by copies desc limit 60) x),
  'dupes_across_levels', (select coalesce(json_agg(x), '[]'::json) from (
      select min(topic_ko) as example, string_agg(distinct level, ',') as levels, count(*) as copies
        from act group by norm having count(distinct level) > 1 order by copies desc limit 40) x),
  'categories', (select coalesce(json_agg(x), '[]'::json) from (
      select level, coalesce(category,'(none)') as category, count(*) n
        from act group by 1,2 order by 1, 3 desc) x),
  'all_topics', (select json_agg(x) from (select level, topic_ko from act order by level, sort_order, created_at) x)
) as report;
