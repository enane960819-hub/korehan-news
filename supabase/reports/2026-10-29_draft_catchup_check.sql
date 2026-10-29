-- (app_settings.value is text holding JSON.)
-- Did the 2026-10-29 draft catch-up (20261029_draft_catchup.sql) make today's drafts?
select json_build_object(
  'catchup_job_still_scheduled', exists (select 1 from cron.job where jobname = 'daily-article-draft-catchup'),
  'catchup_runs', (select json_agg(json_build_object('at', d.start_time, 'status', d.status, 'msg', left(d.return_message, 120)) order by d.start_time)
                   from cron.job_run_details d join cron.job j using (jobid)
                   where j.jobname = 'daily-article-draft-catchup' and d.start_time > '2026-10-28 23:40:00+00'),
  'catchup_http', (select json_agg(json_build_object('at', created, 'code', status_code, 'body', left(content::text, 160)) order by created)
                   from net._http_response where created > '2026-10-28 23:40:00+00'),
  -- to_jsonb so a missing column (created_at vs date) cannot break the report
  'articles_today', (select json_agg(json_build_object('id', j->>'id', 'title', left(j->>'title', 60), 'level', j->>'level',
                       'status', j->>'status', 'date', j->>'date', 'created_at', j->>'created_at'))
                     from (select to_jsonb(a) j from public.articles a) x
                     where coalesce(j->>'created_at', j->>'date') >= '2026-10-29'),
  'queue_picks', (select json_agg(json_build_object('level', p->>'level', 'status', p->>'status', 'attempts', p->>'attempts', 'title', left(p->'headline'->>'title', 60)))
                  from public.app_settings s, jsonb_array_elements(
                    (s.value::jsonb)->'picks') p
                  where s.key = 'daily_article_draft_queue'),
  'queue_date', (select (value::jsonb)->>'date'
                 from public.app_settings where key = 'daily_article_draft_queue')
);
