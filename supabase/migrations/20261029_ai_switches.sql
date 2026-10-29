-- auto-apply
-- Owner request 2026-10-29: every paid AI call can be switched off in the
-- admin, and every dollar is tracked. Edge Functions read
-- app_settings.ai_switches through _shared/ai-gate.ts before each call; the
-- admin page korehan-x9f4k2m7-ai.html reads kh_ai_costs() and writes the
-- switches (app_settings is admin-write; this key is not in the public
-- read allow-list).

-- 1. Default: everything on, no cap. Never overwrite the owner's choices.
insert into public.app_settings (key, value)
values ('ai_switches', '{"all":true,"site":true,"jobs":{"topik-gen":false},"off_features":[],"daily_cap_usd":null}')
on conflict (key) do nothing;

-- 2. Haiku 4.5 is $1 / $5 per million tokens (was under-counted at 0.80 / 4).
create or replace function public._kh_claude_price_usd(p_model text, p_in_tokens int, p_out_tokens int)
returns numeric language plpgsql immutable as $$
declare
  v_in_per_m  numeric;
  v_out_per_m numeric;
begin
  case coalesce(p_model, '')
    when 'claude-opus-4-7'           then v_in_per_m := 15.00; v_out_per_m := 75.00;
    when 'claude-haiku-4-5-20251001' then v_in_per_m :=  1.00; v_out_per_m :=  5.00;
    when 'claude-haiku-4-5'          then v_in_per_m :=  1.00; v_out_per_m :=  5.00;
    else                                  v_in_per_m :=  3.00; v_out_per_m := 15.00;   -- Sonnet and unknown models
  end case;
  return round(coalesce(p_in_tokens, 0)::numeric * v_in_per_m / 1000000.0
             + coalesce(p_out_tokens, 0)::numeric * v_out_per_m / 1000000.0, 6);
end;
$$;

-- 3. Today's spend (KST day) — the daily cap check in ai-gate.ts.
create or replace function public.kh_ai_spend_today()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 0)
    from public.claude_api_usage
   where created_at >= ((now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul');
$$;
revoke all on function public.kh_ai_spend_today() from public, anon, authenticated;
grant execute on function public.kh_ai_spend_today() to service_role;

-- 4. Cost data for the admin page: per day × feature × model, plus cron jobs.
create or replace function public.kh_ai_costs(p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin_email() then
    raise exception 'admin only';
  end if;
  return json_build_object(
    'rows', (select coalesce(json_agg(r order by r.day desc, r.usd desc), '[]'::json) from (
      select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day,
             coalesce(feature, '(none)') as feature, coalesce(model, '(none)') as model,
             count(*) as calls,
             sum(coalesce(input_tokens, 0))::bigint as in_tok,
             sum(coalesce(output_tokens, 0))::bigint as out_tok,
             round(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 4) as usd
        from public.claude_api_usage
       where created_at > now() - make_interval(days => least(greatest(p_days, 1), 120))
       group by 1, 2, 3) r),
    'today_usd', public.kh_ai_spend_today(),
    'month_usd', (select round(coalesce(sum(public._kh_claude_price_usd(model, input_tokens, output_tokens)), 0), 2)
                    from public.claude_api_usage
                   where created_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'),
    'last_call', (select max(created_at) from public.claude_api_usage),
    'crons', (select coalesce(json_agg(json_build_object('name', jobname, 'schedule', schedule, 'active', active) order by jobname), '[]'::json) from cron.job)
  );
end;
$$;
revoke all on function public.kh_ai_costs(int) from public, anon;
grant execute on function public.kh_ai_costs(int) to authenticated;
