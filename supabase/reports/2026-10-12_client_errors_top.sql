-- Real errors browsers reported in the last 30 days (read-only), grouped so
-- the bug sweep can start with what users actually hit.
select json_build_object(
  'total_30d', (select count(*) from public.client_errors where created_at > now() - interval '30 days'),
  'by_message', (select json_agg(x) from (
      select left(regexp_replace(message, '[0-9a-f]{8}-[0-9a-f-]{27}|\d{3,}', '#', 'g'), 140) as msg,
             count(*) as n, count(distinct user_id) as users, max(created_at) as last_seen,
             min(severity) as severity,
             (array_agg(distinct coalesce(context->>'page', context->>'source', context->>'url', '')))[1:3] as where_
        from public.client_errors where created_at > now() - interval '30 days'
       group by 1 order by count(*) desc limit 40) x),
  'by_page', (select json_agg(x) from (
      select coalesce(context->>'page', context->>'path', context->>'source', '?') as page, count(*) n
        from public.client_errors where created_at > now() - interval '30 days'
       group by 1 order by 2 desc limit 20) x)
) as report;
