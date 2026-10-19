-- Morning-cron health check (read-only). Diagnoses why daily-article-draft
-- (06:00-06:55 KST news drafts) and daily-content-gen stopped producing.
-- No new articles since 2026-10-15 KST; study_daily_content not updated since
-- 2026-10-11. Both jobs auth with vault 'cron_secret' via pg_net.
select json_build_object(
  'now_kst', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
  'cron_jobs', (
    select coalesce(json_agg(json_build_object(
      'id', jobid, 'name', jobname, 'schedule', schedule, 'active', active) order by jobid), '[]'::json)
    from cron.job),
  'article_draft_runs', (
    select coalesce(json_agg(x), '[]'::json) from (
      select d.status, left(d.return_message, 180) as msg,
             to_char(d.start_time at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as start_kst,
             to_char(d.end_time   at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as end_kst
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where j.jobname = 'daily-article-draft'
       order by d.start_time desc limit 10) x),
  'content_gen_runs', (
    select coalesce(json_agg(x), '[]'::json) from (
      select d.status, left(d.return_message, 180) as msg,
             to_char(d.start_time at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as start_kst
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where j.jobname = 'daily-content-gen'
       order by d.start_time desc limit 10) x),
  'recent_http_responses', (
    select coalesce(json_agg(x), '[]'::json) from (
      select status_code, left(content::text, 220) as content,
             to_char(created at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as created_kst
        from net._http_response order by created desc limit 15) x),
  'cron_secret_present', (
    select count(*) from vault.secrets where name = 'cron_secret'),
  'article_analyze_log_recent', (
    select coalesce(json_agg(x), '[]'::json) from (
      select status, left(coalesce(error, ''), 120) as error, count(*) as n,
             to_char(max(created_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as last_kst
        from public.article_analyze_log
       where created_at > now() - interval '5 days'
       group by 1, 2 order by n desc limit 15) x),
  'content_gen_lock', (
    select json_agg(json_build_object('key', key, 'value', value))
      from public.app_settings where key ilike '%lock%'),
  'articles_by_day', (
    select coalesce(json_agg(x), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day_kst, count(*) as n
        from public.articles
       where created_at > now() - interval '10 days'
       group by 1 order by 1 desc) x),
  'errors_3d', (
    select coalesce(json_agg(x), '[]'::json) from (
      select left(message, 140) as message, severity, count(*) as n,
             to_char(max(created_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as last_kst
        from public.client_errors
       where created_at > now() - interval '3 days'
       group by 1,2 order by n desc limit 15) x)
) as report;
