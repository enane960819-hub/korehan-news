-- auto-apply
-- Cut background disk IO (owner-approved 2026-10-29, after the Nano disk IO
-- budget ran out and the DB stopped answering):
--   1. cron.job_run_details had grown to 126 MB (never purged). Keep 3 days.
--   2. Purge it daily from now on.
--   3. article-gen-jobs: every minute → every 5 minutes (it only works while
--      bulk generation jobs are queued).
--   4. kh_warm_postgrest (every 4 min) is off: Pro projects don't pause.

-- 1. Keep the last 3 days. TRUNCATE + re-insert is far cheaper than deleting
--    ~all rows; fall back to DELETE if this role may not truncate.
do $$
begin
  create temp table _kh_keep_runs on commit drop as
    select * from cron.job_run_details where start_time > now() - interval '3 days';
  truncate cron.job_run_details;
  insert into cron.job_run_details select * from _kh_keep_runs;
exception when insufficient_privilege then
  delete from cron.job_run_details where start_time <= now() - interval '3 days';
end
$$;

-- 2. Daily purge, 03:50 KST.
select cron.unschedule(jobid) from cron.job where jobname = 'kh_purge_cron_history';
select cron.schedule(
  'kh_purge_cron_history',
  '50 18 * * *',
  $$ delete from cron.job_run_details where start_time < now() - interval '3 days' $$
);

-- 3. Same command, gentler schedule.
select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname = 'article-gen-jobs';

-- 4. Off.
select cron.unschedule(jobid) from cron.job where jobname = 'kh_warm_postgrest';
