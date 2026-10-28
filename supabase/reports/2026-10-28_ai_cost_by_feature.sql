-- AI spend by feature, last 30 days, split admin vs learners (read-only).
with u as (
  select c.feature, c.model, c.input_tokens, c.output_tokens, c.user_id, c.created_at,
         (au.email = 'enane960819@gmail.com') as is_admin,
         (coalesce(c.input_tokens,0)/1e6) * case when c.model like '%haiku%' then 0.8 when c.model like '%opus%' then 15 else 3 end
       + (coalesce(c.output_tokens,0)/1e6) * case when c.model like '%haiku%' then 4 when c.model like '%opus%' then 75 else 15 end as usd
  from claude_api_usage c left join auth.users au on au.id = c.user_id
  where c.created_at > now() - interval '30 days'
)
select json_build_object(
  'totals', (select json_agg(t) from (select is_admin, count(*) calls, count(distinct user_id) users, round(sum(usd)::numeric,2) usd from u group by is_admin) t),
  'learner_by_feature', (select json_agg(t) from (
     select feature, string_agg(distinct model, ',') models, count(*) calls, count(distinct user_id) users,
            round(sum(usd)::numeric,3) usd, round(avg(input_tokens)) avg_in, round(avg(output_tokens)) avg_out
     from u where not coalesce(is_admin,false) group by feature order by sum(usd) desc limit 40) t),
  'admin_by_feature', (select json_agg(t) from (
     select feature, count(*) calls, round(sum(usd)::numeric,3) usd
     from u where coalesce(is_admin,false) group by feature order by sum(usd) desc limit 25) t),
  'by_day', (select json_agg(t) from (
     select to_char(date_trunc('day', created_at),'MM-DD') d, count(*) calls, round(sum(usd)::numeric,2) usd
     from u group by 1 order by 1) t)
) as report;
