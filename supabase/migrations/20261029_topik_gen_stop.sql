-- auto-apply
-- Owner (2026-10-29): no AI spend on test generation. Stop the topik-gen
-- worker and cancel every waiting job. Re-enabling needs the owner's OK.
select cron.unschedule(jobid) from cron.job where jobname = 'topik-gen-jobs';
update public.topik_gen_jobs set status = 'failed', error = 'stopped by owner (no AI spend)', updated_at = now()
 where status in ('pending', 'running');
