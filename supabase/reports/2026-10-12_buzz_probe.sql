-- Buzz source probe results (read-only). Pairs each probe request with
-- pg_net's response: status, body size, and simple bot-wall signals.
select json_agg(x order by x.source) as report from (
  select p.source,
         r.status_code,
         length(r.content) as bytes,
         r.timed_out,
         left(r.error_msg, 120) as error,
         (r.content ilike '%cf-browser-verification%' or r.content ilike '%challenge-platform%'
           or r.content ilike '%captcha%' or r.content ilike '%Just a moment%') as bot_wall,
         left(regexp_replace(coalesce(substring(r.content from '<title>([^<]{0,120})'), ''), '\s+', ' ', 'g'), 80) as title,
         (select count(*) from regexp_matches(coalesce(r.content, ''), '<item>|<a [^>]*href="[^"]*(view|read|talk/[0-9]|/[0-9]{6,})', 'g')) as link_like
    from (select distinct on (source) * from public.buzz_source_probe order by source, id desc) p
    left join net._http_response r on r.id = p.request_id
) x;
