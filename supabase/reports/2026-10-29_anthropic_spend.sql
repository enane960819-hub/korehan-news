-- Where did the Anthropic credit go? (credits ran out 2026-10-29 morning KST)
-- Same pricing helper as the cost monitor (_kh_claude_price_usd).
select json_build_object(
  'by_day_21d', (
    select coalesce(json_agg(x order by x.day desc), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'MM-DD') as day, count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage where created_at > now() - interval '21 days' group by 1) x),
  'by_feature_21d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select coalesce(feature,'(none)') as feature, coalesce(model,'(none)') as model, count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage where created_at > now() - interval '21 days'
       group by 1,2 order by usd desc limit 25) x),
  'by_feature_7d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select coalesce(feature,'(none)') as feature, count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage where created_at > now() - interval '7 days'
       group by 1 order by usd desc limit 20) x),
  'feature_by_day_7d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'MM-DD') as day, coalesce(feature,'(none)') as feature, count(*) as calls,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) as usd
        from public.claude_api_usage where created_at > now() - interval '7 days'
       group by 1,2 order by usd desc limit 30) x),
  'top_users_7d', (
    select coalesce(json_agg(x order by x.usd desc), '[]'::json) from (
      select left(u.user_id::text, 8) as user8, coalesce(a.email like '%enane960819%', false) as owner_account, count(*) as calls,
             round(sum(public._kh_claude_price_usd(u.model, u.input_tokens, u.output_tokens)), 2) as usd
        from public.claude_api_usage u left join auth.users a on a.id = u.user_id
       where u.created_at > now() - interval '7 days'
       group by 1,2 order by usd desc limit 10) x),
  'last_success_kst', (select to_char(max(created_at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI') from public.claude_api_usage where coalesce(output_tokens,0) > 0),
  'total_21d_usd', (select round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 2) from public.claude_api_usage where created_at > now() - interval '21 days')
) as report;
