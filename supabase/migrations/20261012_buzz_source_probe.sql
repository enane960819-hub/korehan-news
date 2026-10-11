-- auto-apply
-- Buzz section — source reachability probe (no AI, no user data).
-- Fires one GET per candidate community / trend feed from Supabase's
-- network via pg_net and records the request ids; the read-only report
-- supabase/reports/2026-10-12_buzz_probe.sql joins them with
-- net._http_response to see which sources are readable (status, size,
-- whether it looks like a bot wall). Safe to re-run.

create extension if not exists pg_net;

create table if not exists public.buzz_source_probe (
  id          bigserial primary key,
  source      text not null,
  url         text not null,
  request_id  bigint,
  created_at  timestamptz not null default now()
);
alter table public.buzz_source_probe enable row level security; -- service only

insert into public.buzz_source_probe (source, url, request_id)
select s.source, s.url,
       net.http_get(
         url := s.url,
         headers := jsonb_build_object(
           'User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
           'Accept-Language', 'ko-KR,ko;q=0.9,en;q=0.8'),
         timeout_milliseconds := 15000)
from (values
  ('google-trends-kr', 'https://trends.google.com/trending/rss?geo=KR'),
  ('nate-pann-ranking', 'https://pann.nate.com/talk/ranking'),
  ('nate-pann-today',  'https://pann.nate.com/talk/ranking/d'),
  ('instiz-hot',       'https://www.instiz.net/pt?category=1'),
  ('theqoo-hot',       'https://theqoo.net/hot'),
  ('clien-park',       'https://www.clien.net/service/board/park'),
  ('clien-recommend',  'https://www.clien.net/service/recommend'),
  ('ruliweb-best',     'https://bbs.ruliweb.com/best/humor_only'),
  ('ppomppu-rss',      'https://www.ppomppu.co.kr/rss.php?id=freeboard'),
  ('dcinside-hit',     'https://gall.dcinside.com/board/lists/?id=hit'),
  ('fmkorea-best',     'https://www.fmkorea.com/best'),
  ('bobaedream-best',  'https://www.bobaedream.co.kr/list?code=best'),
  ('mlbpark-bullpen',  'https://mlbpark.donga.com/mp/b.php?b=bullpen'),
  ('todayhumor-best',  'https://www.todayhumor.co.kr/board/list.php?table=bestofbest'),
  ('issuelink',        'https://www.issuelink.co.kr/community/listview/all/3/adj/_self/blank/blank/blank'),
  ('naver-news-rank',  'https://news.naver.com/main/ranking/popularDay.naver')
) as s(source, url);
