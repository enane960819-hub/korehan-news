-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Atomic usage reservations for the paid proxies (2026-10-30 security pass)
-- ═════════════════════════════════════════════════════════════════════
-- 1. kh_ai_reserve() — claude-proxy used to read claude_api_usage, check the
--    daily-call / monthly-USD caps, call Anthropic, and only THEN log the row.
--    N parallel requests all passed the check before any of them logged, so
--    the caps could be overshot by any amount. Now the proxy calls this
--    function first: a per-user transaction advisory lock serialises
--    reservations, the caps are checked against every row (including other
--    in-flight reservations), and a claude_api_usage row priced at this
--    call's worst case (estimated input + the full max_tokens) is inserted
--    before Anthropic is called. The proxy then updates that row to the real
--    token counts (0 on upstream errors; a timeout keeps the estimate since
--    it may have been billed). Prices come from the proxy (p_prices) so
--    MODEL_PRICING in claude-proxy/index.ts stays the single price table.
-- 2. edge_usage_daily + kh_edge_usage_take() — per-user per-KST-day counters
--    for tts-proxy (300/day) and speech-proxy (60/day). The limits live in the
--    Edge Functions; this only counts atomically.
-- Both functions are service_role only (the Edge Functions use the service
-- key); anon / authenticated can't call them or read the counters.
-- No existing rows are changed. Idempotent: safe to re-run.

create or replace function public.kh_ai_reserve(
  p_user        uuid,
  p_feature     text,
  p_model       text,
  p_est_input   integer,
  p_est_output  integer,
  p_daily_limit integer,
  p_monthly_usd numeric,
  p_prices      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start   timestamptz := v_today::timestamp at time zone 'Asia/Seoul';
  v_month_start timestamptz := date_trunc('month', v_today::timestamp) at time zone 'Asia/Seoul';
  v_def_in      numeric := coalesce((p_prices->'_default'->>'input')::numeric, 3);
  v_def_out     numeric := coalesce((p_prices->'_default'->>'output')::numeric, 15);
  v_calls       integer;
  v_usd         numeric;
  v_id          bigint;
begin
  -- service_role only (grants below); auth.uid() is null for that caller,
  -- so the user is the explicit argument.
  if p_user is null then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kh_ai_reserve:' || p_user::text, 0));

  select count(*) filter (where u.created_at >= v_day_start),
         coalesce(sum(
           coalesce(u.input_tokens, 0)  / 1000000.0 * coalesce((p_prices->u.model->>'input')::numeric,  v_def_in)
         + coalesce(u.output_tokens, 0) / 1000000.0 * coalesce((p_prices->u.model->>'output')::numeric, v_def_out)
         ), 0)
    into v_calls, v_usd
    from public.claude_api_usage u
   where u.user_id = p_user
     and u.created_at >= v_month_start;

  if v_calls >= coalesce(p_daily_limit, 0) then
    return jsonb_build_object('ok', false, 'code', 'daily_call_limit',
                              'calls_today', v_calls, 'monthly_usd', round(v_usd, 4));
  end if;
  if v_usd >= coalesce(p_monthly_usd, 0) then
    return jsonb_build_object('ok', false, 'code', 'monthly_cost_limit',
                              'calls_today', v_calls, 'monthly_usd', round(v_usd, 4));
  end if;

  insert into public.claude_api_usage (user_id, feature, model, input_tokens, output_tokens)
  values (p_user, left(p_feature, 64), left(p_model, 64),
          greatest(coalesce(p_est_input, 0), 0), greatest(coalesce(p_est_output, 0), 0))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id,
                            'calls_today', v_calls + 1, 'monthly_usd', round(v_usd, 4));
end;
$$;

revoke all on function public.kh_ai_reserve(uuid, text, text, integer, integer, integer, numeric, jsonb) from public;
revoke all on function public.kh_ai_reserve(uuid, text, text, integer, integer, integer, numeric, jsonb) from anon;
revoke all on function public.kh_ai_reserve(uuid, text, text, integer, integer, integer, numeric, jsonb) from authenticated;
grant execute on function public.kh_ai_reserve(uuid, text, text, integer, integer, integer, numeric, jsonb) to service_role;

-- ── Per-user daily counters for the speech proxies ─────────────────────
create table if not exists public.edge_usage_daily (
  user_id uuid    not null,
  service text    not null,
  day     date    not null,
  count   integer not null default 0,
  primary key (user_id, service, day)
);
alter table public.edge_usage_daily enable row level security;
-- No policies: only service_role (bypasses RLS) and the definer function.
revoke all on public.edge_usage_daily from anon, authenticated;

-- Takes one unit of p_service for p_user today (KST) if fewer than p_limit
-- were taken. Returns {ok, count}. Atomic: the conditional upsert locks the row.
create or replace function public.kh_edge_usage_take(p_user uuid, p_service text, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  if p_user is null or coalesce(p_service, '') = '' or coalesce(p_limit, 0) <= 0 then
    return jsonb_build_object('ok', false, 'count', 0);
  end if;
  insert into public.edge_usage_daily as e (user_id, service, day, count)
  values (p_user, left(p_service, 32), v_day, 1)
  on conflict (user_id, service, day)
    do update set count = e.count + 1
    where e.count < p_limit
  returning e.count into v_count;
  if v_count is null then
    return jsonb_build_object('ok', false, 'count', p_limit);
  end if;
  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

revoke all on function public.kh_edge_usage_take(uuid, text, integer) from public;
revoke all on function public.kh_edge_usage_take(uuid, text, integer) from anon;
revoke all on function public.kh_edge_usage_take(uuid, text, integer) from authenticated;
grant execute on function public.kh_edge_usage_take(uuid, text, integer) to service_role;

notify pgrst, 'reload schema';
