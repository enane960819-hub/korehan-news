-- auto-apply
-- Reporters page (korehan-reporters.html): how many published articles each
-- reporter wrote, in ONE call instead of one count query per reporter.
-- PostgREST aggregate functions are disabled on this project (PGRST123), so
-- the count lives in a small read-only function. SECURITY INVOKER: it reads
-- articles with the caller's own RLS, so it can never count rows the caller
-- couldn't see anyway. Fake News (section 'fake') is excluded like every
-- real-news list. Idempotent.
create or replace function public.kh_reporter_article_counts()
returns table (reporter_id text, n bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.reporter_id::text, count(*)::bigint
    from public.articles a
   where a.reporter_id is not null
     and (a.status is null or a.status = 'published')
     and a.section is distinct from 'fake'
   group by a.reporter_id
$$;

revoke all on function public.kh_reporter_article_counts() from public;
grant execute on function public.kh_reporter_article_counts() to anon, authenticated;
