-- TOPIK generator: job progress, errors and resulting tests (read-only).
select id, level, section, status, ticks, test_id,
       (progress->>'chunk')::int as chunk, (progress->>'tries')::int as tries,
       (progress->'pending') is not null and progress->'pending' <> 'null'::jsonb as checking,
       left(error, 200) as error, created_at, updated_at
  from public.topik_gen_jobs order by created_at desc limit 30;
select id, title, status, free, flagged, (select count(*) from public.topik_items i where i.test_id = t.id) as items,
       (select count(*) from public.topik_items i where i.test_id = t.id and i.qa_flag is not null) as flagged_items
  from public.topik_tests t order by sort;
select test_id, n, left(qa_flag, 160) as flag from public.topik_items where qa_flag is not null order by test_id, n limit 40;
select feature, count(*), sum(input_tokens) as input, sum(output_tokens) as output
  from public.claude_api_usage where feature like 'cron:topik%' and created_at > now() - interval '1 day' group by feature;
