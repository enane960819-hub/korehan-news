-- Study Room "Today's Topic" health check (read-only).
select json_build_object(
  'now_kst', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
  'daily_content', (
    select coalesce(json_agg(r order by r.scheduled_date, r.level), '[]'::json) from (
      select scheduled_date, level, topic_ko, status, admin_edited,
             case when jsonb_typeof(to_jsonb(vocab)) = 'array' then jsonb_array_length(to_jsonb(vocab)) else null end as vocab_n,
             case when jsonb_typeof(to_jsonb(grammar)) = 'array' then jsonb_array_length(to_jsonb(grammar)) else null end as grammar_n,
             to_char(created_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as created_kst
        from public.study_daily_content
       where scheduled_date between ((now() at time zone 'Asia/Seoul')::date - 2) and ((now() at time zone 'Asia/Seoul')::date + 1)
    ) r),
  'cron_jobs', (select coalesce(json_agg(json_build_object('id', jobid, 'name', jobname, 'schedule', schedule, 'active', active) order by jobid), '[]'::json) from cron.job),
  'daily_content_gen_runs', (
    select coalesce(json_agg(x), '[]'::json) from (
      select d.status, left(d.return_message, 160) as msg,
             to_char(d.start_time at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as start_kst
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where j.jobname = 'daily-content-gen'
       order by d.start_time desc limit 5) x),
  'recent_http_responses', (
    select coalesce(json_agg(x), '[]'::json) from (
      select status_code, left(content::text, 200) as content,
             to_char(created at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as created_kst
        from net._http_response order by created desc limit 8) x),
  'study_errors_3d', (
    select coalesce(json_agg(x), '[]'::json) from (
      select left(message, 120) as message, count(*) as n
        from public.client_errors
       where created_at > now() - interval '3 days'
         and (message ilike '%daily%' or message ilike '%study%' or message ilike '%topic%')
       group by 1 order by n desc limit 10) x)
) as report;
