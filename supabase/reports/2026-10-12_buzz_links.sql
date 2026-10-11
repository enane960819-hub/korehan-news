-- Buzz: sample post links/titles from each readable source page (read-only),
-- to write the list-page parsers. Uses the pg_net responses of the probe.
select json_object_agg(source, links) as report from (
  select p.source,
         (select json_agg(m) from (
            select (regexp_matches(r.content, '<a[^>]*href="([^"]{6,220})"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{8,90})<', 'g')) as m
            limit 400) z
          where (m[1] ~ '(view|read|talk/[0-9]|/[0-9]{6,}|no=|wr_id|document_srl|/hot/|/park/|/pt/|best)')
            and length(btrim(m[2])) >= 8
         ) as links
    from (select distinct on (source) * from public.buzz_source_probe order by source, id desc) p
    join net._http_response r on r.id = p.request_id
   where r.status_code = 200 and p.source in ('nate-pann-ranking','instiz-hot','theqoo-hot','clien-park','dcinside-hit','bobaedream-best','issuelink','google-trends-kr')
) x;
