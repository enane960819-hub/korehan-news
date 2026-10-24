-- Launch-audit health snapshot (read-only). Feeds the 2026-10 fix list:
-- is the content automation alive, what is AI spend doing, and where do
-- the odd vocabulary words (e.g. 공기 정화 시스템) in saved words /
-- flashcards come from. Column-agnostic for tables whose schema isn't in
-- the repo (rows sampled via to_jsonb).
select json_build_object(
  'now_kst', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),

  'articles_by_day_14d', (select coalesce(json_agg(x order by x.d desc), '[]'::json) from (
      select (created_at at time zone 'Asia/Seoul')::date as d, status, count(*) as n
        from articles where created_at > now() - interval '14 days' group by 1, 2) x),
  'articles_totals', (select json_build_object(
      'published', count(*) filter (where status = 'published'),
      'draft', count(*) filter (where status <> 'published'),
      'buzz_published', count(*) filter (where status = 'published' and lower(coalesce(section,'')) in ('buzz','korea buzz','버즈'))) from articles),

  'cron_jobs', (select coalesce(json_agg(json_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobid), '[]'::json) from cron.job),
  'cron_runs_3d', (select coalesce(json_agg(x), '[]'::json) from (
      select j.jobname, count(*) as runs, count(*) filter (where d.status = 'succeeded') as ok,
             to_char(max(d.start_time) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as last_kst
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
       where d.start_time > now() - interval '3 days' group by 1) x),
  'recent_http_errors', (select coalesce(json_agg(x), '[]'::json) from (
      select status_code, left(content::text, 160) as content,
             to_char(created at time zone 'Asia/Seoul', 'MM-DD HH24:MI') as at_kst
        from net._http_response where status_code is distinct from 200
       order by created desc limit 10) x),

  'claude_usage_7d', (select coalesce(json_agg(x), '[]'::json) from (
      select coalesce(feature, '(none)') as feature, count(*) as calls,
             sum(coalesce(input_tokens,0)) as in_tok, sum(coalesce(output_tokens,0)) as out_tok
        from claude_api_usage where created_at > now() - interval '7 days'
       group by 1 order by 3 desc limit 25) x),

  'content_counts', json_build_object(
      'conversations', (select count(*) from conversations_data),
      'study_daily_content_last', (select max(scheduled_date) from study_daily_content)),

  -- vocabulary sources
  'saved_words_columns', (select json_agg(column_name order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'user_saved_words'),
  'saved_words_total', (select count(*) from user_saved_words),
  'saved_words_sample', (select coalesce(json_agg(r), '[]'::json) from (select to_jsonb(t) - 'user_id' as r from user_saved_words t limit 12) s),
  'saved_words_with_space_or_long', (select count(*) from user_saved_words t
      where coalesce(to_jsonb(t)->>'word', to_jsonb(t)->>'ko', '') ~ ' ' or char_length(coalesce(to_jsonb(t)->>'word', to_jsonb(t)->>'ko', '')) >= 5),
  'vocabulary_bank_columns', (select json_agg(column_name order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'vocabulary_bank'),
  'vocabulary_bank_total', (select count(*) from vocabulary_bank),
  'vocabulary_bank_sample', (select coalesce(json_agg(r), '[]'::json) from (select to_jsonb(t) as r from vocabulary_bank t order by random() limit 15) s),
  'vocabulary_bank_spaced_or_long', (select count(*) from vocabulary_bank t
      where coalesce(to_jsonb(t)->>'word', to_jsonb(t)->>'ko', to_jsonb(t)->>'korean', '') ~ ' '
         or char_length(coalesce(to_jsonb(t)->>'word', to_jsonb(t)->>'ko', to_jsonb(t)->>'korean', '')) >= 5)
);
