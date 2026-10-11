-- Why no Korea Buzz draft today? Queue state + buzz articles + recent errors (read-only).
select json_build_object(
  'queue_date', (q.value::jsonb)->>'date',
  'queue_buzz', (q.value::jsonb)->'buzz',
  'picks', (select json_agg(json_build_object('kind', p->>'kind', 'level', p->>'level', 'status', p->>'status',
                  'attempts', p->>'attempts', 'error', p->>'error', 'title', coalesce(p->>'title_ko', p->'headline'->>'title')))
              from jsonb_array_elements((q.value::jsonb)->'picks') p),
  'buzz_articles', (select json_agg(json_build_object('id', id, 'title', title, 'status', status, 'date', date))
                      from public.articles where section = 'buzz'),
  'cron_runs', (select json_agg(x) from (select start_time, status, left(return_message, 120) msg from cron.job_run_details
                  where jobid = 10 order by start_time desc limit 14) x),
  'errors', (select json_agg(x) from (select created_at, left(message, 200) message from public.client_errors
               where created_at > now() - interval '12 hours' and (message ilike '%buzz%' or message ilike '%daily-article%' or context->>'source' = 'daily-article-draft')
               order by created_at desc limit 10) x)
) as report
from public.app_settings q where q.key = 'daily_article_draft_queue';
