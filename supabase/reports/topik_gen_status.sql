-- TOPIK generator: one combined JSON (the report API returns only the last statement).
select jsonb_build_object(
  'jobs', (select jsonb_agg(jsonb_build_object('lv', level, 'sec', section, 'status', status, 'ticks', ticks, 'test', test_id,
            'chunk', progress->>'chunk', 'tries', progress->>'tries', 'err', left(error, 160)) order by created_at)
           from public.topik_gen_jobs),
  'tests', (select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'flagged', flagged,
            'items', (select count(*) from public.topik_items i where i.test_id = t.id)) order by sort)
            from public.topik_tests t where source = 'gen'),
  'flags', (select jsonb_agg(jsonb_build_object('q', test_id || '#' || n, 'flag', left(qa_flag, 140)))
            from (select * from public.topik_items where qa_flag is not null order by test_id, n limit 30) f),
  'usage', (select jsonb_agg(jsonb_build_object('f', feature, 'calls', c, 'in', i, 'out', o)) from (
            select feature, count(*) c, sum(input_tokens) i, sum(output_tokens) o from public.claude_api_usage
             where feature like 'cron:topik%' and created_at > now() - interval '1 day' group by feature) u)
) as status;
