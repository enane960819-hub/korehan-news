-- Anthropic cost forensics (read-only). Credits drained unexpectedly fast
-- after a recent top-up; find where the spend actually went. Cost is
-- derived with the same _kh_claude_price_usd() pricing the cost monitor uses.
-- NOTE: a 400 "credit too low" call logs little/no usage, so the real burn
-- is in the window BEFORE credits ran out (~2026-10-15).
select json_build_object(
  'now_kst', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
  'cost_by_day_30d', (
    select coalesce(json_agg(x order by x.day desc), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day,
             count(*) as calls,
             sum(coalesce(input_tokens,0))::bigint  as in_tok,
             sum(coalesce(output_tokens,0))::bigint as out_tok,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage
       where created_at > now() - interval '30 days'
       group by 1) x),
  'cost_by_feature_30d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select coalesce(feature,'(none)') as feature, coalesce(model,'(none)') as model,
             count(*) as calls,
             sum(coalesce(input_tokens,0))::bigint  as in_tok,
             sum(coalesce(output_tokens,0))::bigint as out_tok,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage
       where created_at > now() - interval '30 days'
       group by 1,2 order by usd desc limit 30) x),
  'feature_by_day_14d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'MM-DD') as day,
             coalesce(feature,'(none)') as feature,
             count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage
       where created_at > now() - interval '14 days'
       group by 1,2 order by usd desc limit 40) x),
  'top_users_14d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select left(coalesce(user_id::text,'(null)'), 8) as user8,
             count(*) as calls,
             sum(coalesce(output_tokens,0))::bigint as out_tok,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage
       where created_at > now() - interval '14 days'
       group by 1 order by usd desc limit 15) x),
  'overall_30d', (
    select json_build_object(
      'total_calls', count(*),
      'total_usd', round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2),
      'first_row_kst', to_char(min(created_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI'),
      'last_row_kst',  to_char(max(created_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI'))
      from public.claude_api_usage where created_at > now() - interval '30 days')
) as report;
