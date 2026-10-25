-- Read-only: why kh_purge_old_signup_pii fails (0/3 on 2026-10-24) and
-- whether the 20261025 guard fix covers the exact call the job makes.
select json_build_object(
  'job', (select json_agg(json_build_object('name', jobname, 'schedule', schedule, 'command', command, 'username', username))
            from cron.job where jobname = 'kh_purge_old_signup_pii'),
  'last_runs', (select coalesce(json_agg(x), '[]'::json) from (
      select d.status, left(d.return_message, 300) as msg,
             to_char(d.start_time at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as start_kst
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where j.jobname = 'kh_purge_old_signup_pii'
       order by d.start_time desc limit 4) x),
  'fn_guard', (select left(pg_get_functiondef('public.purge_old_signup_pii(int)'::regprocedure), 900)),
  'pending_pii_rows', (select count(*) from public.signup_notifications_log
                        where created_at < now() - interval '90 days' and (email is not null or name is not null))
);
