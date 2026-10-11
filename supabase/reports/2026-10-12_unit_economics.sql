-- AI cost by feature + subscription state (read-only). Prices per 1M tokens
-- (in/out): haiku-4-5 1/5, sonnet 3/15, opus 15/75 — rough USD estimate.
with u as (
  select feature, model, input_tokens, output_tokens, created_at, user_id,
         case when model ilike '%haiku%' then 1.0 when model ilike '%opus%' then 15.0 else 3.0 end as pin,
         case when model ilike '%haiku%' then 5.0 when model ilike '%opus%' then 75.0 else 15.0 end as pout
    from public.claude_api_usage
)
select json_build_object(
  'all_time_usd', (select round(sum(input_tokens*pin/1e6 + output_tokens*pout/1e6)::numeric, 2) from u),
  'by_month_usd', (select json_object_agg(m, c) from (
      select to_char(created_at,'YYYY-MM') m, round(sum(input_tokens*pin/1e6 + output_tokens*pout/1e6)::numeric,2) c
        from u group by 1 order by 1) x),
  'top_features_all_time', (select json_agg(x) from (
      select feature, count(*) calls, round(sum(input_tokens*pin/1e6 + output_tokens*pout/1e6)::numeric,2) usd,
             count(distinct user_id) users
        from u group by feature order by usd desc nulls last limit 15) x),
  'user_vs_system_usd', (select json_build_object(
      'user_triggered', round(sum(case when user_id is not null then input_tokens*pin/1e6 + output_tokens*pout/1e6 end)::numeric,2),
      'system_or_admin', round(sum(case when user_id is null then input_tokens*pin/1e6 + output_tokens*pout/1e6 end)::numeric,2)) from u),
  'subscriptions', (select coalesce(json_agg(x), '[]'::json) from (
      select plan, status, count(*) n from public.user_subscriptions group by plan, status) x)
) as report;
