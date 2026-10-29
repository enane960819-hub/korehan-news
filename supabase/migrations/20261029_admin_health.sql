-- auto-apply
-- Admin CMS "Today" panel: one read-only call that says whether anything
-- needs the owner's attention (failed crons, review backlog, drafts, open
-- reports, client errors, failed generation jobs, AI spend vs cap, DB size).
-- Every part is guarded: a missing table / extension / column returns null
-- for that part instead of failing the whole call. No AI. Idempotent.

create or replace function public.kh_admin_health()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out   jsonb := '{}'::jsonb;
  v_part  jsonb;
  v_num   numeric;
  v_cnt   bigint;
  v_set   jsonb;
  r       record;
begin
  if not public.is_admin_email() then
    raise exception 'admin only';
  end if;

  -- 1. Cron: jobs with failed runs in the last 24 h + last success per job.
  begin
    select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) into v_part
      from (
        select jsonb_build_object(
                 'name', j.jobname,
                 'schedule', j.schedule,
                 'active', j.active,
                 'failed_24h', (select count(*) from cron.job_run_details d
                                 where d.jobid = j.jobid and d.status = 'failed'
                                   and d.start_time > now() - interval '24 hours'),
                 'last_failure', (select max(d.start_time) from cron.job_run_details d
                                   where d.jobid = j.jobid and d.status = 'failed'),
                 'last_error', (select left(d.return_message, 200) from cron.job_run_details d
                                 where d.jobid = j.jobid and d.status = 'failed'
                                 order by d.start_time desc limit 1),
                 'last_success', (select max(d.end_time) from cron.job_run_details d
                                   where d.jobid = j.jobid and d.status = 'succeeded')
               ) as x
          from cron.job j
      ) s;
    v_out := v_out || jsonb_build_object('crons', v_part);
  exception when others then
    v_out := v_out || jsonb_build_object('crons', null);
  end;

  -- 2. content-qa backlog: rows with qa_at is null, for every public table
  --    that has a qa_at column (vocabulary_bank, article_cache,
  --    grammar_examples_cache, conversations_data, life_guides, …).
  begin
    v_part := '{}'::jsonb;
    for r in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'qa_at'
         and t.table_type = 'BASE TABLE'
       order by c.table_name
    loop
      begin
        execute format('select count(*) from public.%I where qa_at is null', r.table_name) into v_cnt;
        v_part := v_part || jsonb_build_object(r.table_name, v_cnt);
      exception when others then
        v_part := v_part || jsonb_build_object(r.table_name, null);
      end;
    end loop;
    v_out := v_out || jsonb_build_object('qa_backlog', v_part);
  exception when others then
    v_out := v_out || jsonb_build_object('qa_backlog', null);
  end;

  -- 3. Drafts waiting.
  begin
    select count(*) into v_cnt from public.articles where status = 'draft';
    v_out := v_out || jsonb_build_object('article_drafts', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('article_drafts', null);
  end;
  begin
    select count(*) into v_cnt from public.topik_tests where status = 'draft';
    v_out := v_out || jsonb_build_object('topik_drafts', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('topik_drafts', null);
  end;

  -- 4. Open reports.
  begin
    select count(*) into v_cnt from public.content_reports where status = 'pending';
    v_out := v_out || jsonb_build_object('content_reports_open', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('content_reports_open', null);
  end;
  begin
    select count(*) into v_cnt from public.topik_reports where resolved_at is null;
    v_out := v_out || jsonb_build_object('topik_reports_open', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('topik_reports_open', null);
  end;
  begin
    select count(*) into v_cnt from public.sentence_analysis_reports where status = 'pending';
    v_out := v_out || jsonb_build_object('analysis_reports_open', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('analysis_reports_open', null);
  end;

  -- 5. Client errors in the last 24 h by severity (old admin-api debug rows excluded).
  begin
    select coalesce(jsonb_object_agg(sev, n), '{}'::jsonb) into v_part
      from (
        select coalesce(severity, 'error') as sev, count(*) as n
          from public.client_errors
         where created_at > now() - interval '24 hours'
           and coalesce(message, '') not like 'admin-api debug%'
         group by 1
      ) s;
    v_out := v_out || jsonb_build_object('client_errors_24h', v_part);
  exception when others then
    v_out := v_out || jsonb_build_object('client_errors_24h', null);
  end;

  -- 6. Article generation jobs that failed in the last 24 h.
  begin
    select count(*) into v_cnt from public.article_gen_jobs
     where status = 'failed' and updated_at > now() - interval '24 hours';
    v_out := v_out || jsonb_build_object('gen_jobs_failed_24h', v_cnt);
  exception when others then
    v_out := v_out || jsonb_build_object('gen_jobs_failed_24h', null);
  end;

  -- 7. AI spend today (KST) vs the daily cap in app_settings.ai_switches.
  begin
    v_num := public.kh_ai_spend_today();
    v_out := v_out || jsonb_build_object('ai_spend_today_usd', round(v_num, 2));
  exception when others then
    v_out := v_out || jsonb_build_object('ai_spend_today_usd', null);
  end;
  begin
    -- value may be text or jsonb depending on the install; normalise.
    select to_jsonb(s) -> 'value' into v_set from public.app_settings s where s.key = 'ai_switches';
    if v_set is not null and jsonb_typeof(v_set) = 'string' then
      v_set := (v_set #>> '{}')::jsonb;
    end if;
    v_out := v_out || jsonb_build_object(
      'ai_daily_cap_usd', case when v_set is null then null else v_set -> 'daily_cap_usd' end,
      'ai_all_on', case when v_set is null then null else v_set -> 'all' end);
  exception when others then
    v_out := v_out || jsonb_build_object('ai_daily_cap_usd', null, 'ai_all_on', null);
  end;

  -- 8. Database size.
  begin
    v_out := v_out || jsonb_build_object('db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1));
  exception when others then
    v_out := v_out || jsonb_build_object('db_size_mb', null);
  end;

  v_out := v_out || jsonb_build_object('at', now());
  return v_out::json;
end;
$$;

revoke all on function public.kh_admin_health() from public, anon;
grant execute on function public.kh_admin_health() to authenticated;
