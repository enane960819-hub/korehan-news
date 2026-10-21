-- Sentence-analysis (문장분석) backfill coverage + current status (read-only).
-- How many of the 374 published articles actually got per-sentence analysis,
-- what the backfill state says, and whether baking works right now.
select json_build_object(
  'now_kst', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
  'published_articles', (select count(*) from public.articles where status = 'published'),
  'article_cache_rows', (select count(*) from public.article_cache),
  -- rows whose translation JSON actually carries a non-empty sentences[] array
  'with_sentence_analysis', (
    select count(*) from public.article_cache
     where translation::text like '%"sentences"%'
       and translation::text not like '%"sentences":[]%'
       and translation::text not like '%"sentences": []%'),
  -- published articles that still have NO sentence analysis cached
  'published_missing_analysis', (
    select count(*) from public.articles a
     where a.status = 'published'
       and not exists (
         select 1 from public.article_cache c
          where c.article_id = a.id::text
            and c.translation::text like '%"sentences"%'
            and c.translation::text not like '%"sentences":[]%'
            and c.translation::text not like '%"sentences": []%')),
  'backfill_state', (
    select value from public.app_settings where key = 'analysis_backfill_state'),
  'analyze_log_last5', (
    select coalesce(json_agg(x), '[]'::json) from (
      select status, left(coalesce(error,''),100) as error,
             to_char(created_at at time zone 'Asia/Seoul','MM-DD HH24:MI') as kst
        from public.article_analyze_log order by created_at desc limit 5) x),
  'cron_anthropic_spend_since_fix', (
    select coalesce(json_agg(x), '[]'::json) from (
      select coalesce(feature,'(none)') as feature, count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)),4) as usd
        from public.claude_api_usage
       where created_at > now() - interval '3 days' and feature like 'cron:%'
       group by 1 order by usd desc) x)
) as report;
