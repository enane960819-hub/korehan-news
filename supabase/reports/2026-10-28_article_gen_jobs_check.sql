-- article_gen_jobs: table, policies and the worker cron exist.
-- (re-run after the migration landed)
select 'table' as what, count(*)::text as value from public.article_gen_jobs
union all select 'policy', string_agg(policyname, ', ') from pg_policies where tablename = 'article_gen_jobs'
union all select 'cron', string_agg(jobname || ' ' || schedule || ' active=' || active, '; ') from cron.job where jobname = 'article-gen-jobs';
