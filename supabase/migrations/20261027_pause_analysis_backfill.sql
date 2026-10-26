-- auto-apply
-- Pause the overnight sentence-analysis backfill (owner decision 2026-10-27):
-- the small credit top-up goes to new articles + weekly Study Room content
-- first. ~132 older articles still lack analysis; readers who open one get
-- the on-demand bake as before.
-- To resume: re-run the schedule from 20261013_analysis_backfill_cron.sql
-- (e.g. touch that file in a push to main — it is idempotent).
select cron.unschedule(jobid) from cron.job where jobname = 'analysis-backfill';
