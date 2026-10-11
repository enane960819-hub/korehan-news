-- Full active writing_topics list per level, compact (read-only).
select level, count(*) as n, string_agg(topic_ko, ' | ' order by sort_order, created_at) as topics
  from public.writing_topics where active group by level order by level;
