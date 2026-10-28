-- After 20261029_cron_slim.sql: job list, run-history size, rows kept.
select json_build_object(
  'jobs', (select json_agg(json_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobname) from cron.job),
  'run_history_size', pg_size_pretty(pg_total_relation_size('cron.job_run_details')),
  'run_history_rows', (select count(*) from cron.job_run_details),
  'oldest_run', (select min(start_time) from cron.job_run_details),
  'draft_failures', (select json_agg(t) from (
      select d.start_time, d.status, left(d.return_message, 300) as msg
      from cron.job_run_details d join cron.job j using (jobid)
      where j.jobname = 'daily-article-draft' and d.status <> 'succeeded'
      order by d.start_time desc limit 6) t),
  'draft_http', (select json_agg(t) from (
      select created, status_code, left(content::text, 300) as body, error_msg
      from net._http_response order by created desc limit 8) t)
);
