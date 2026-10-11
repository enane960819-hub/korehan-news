-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- sentence_analysis_reports: accept Study Room lesson reports
-- ═════════════════════════════════════════════════════════════════════
-- Grammar Focus (korehan-study-room) now has a 🚩 Report button that
-- writes to the same queue: content_type 'study_room', content_id
-- 'gf:<pattern>:<tab>', and a new reason 'answer' (wrong answer key).
-- Idempotent.

alter table public.sentence_analysis_reports drop constraint if exists sentence_analysis_reports_content_type_check;
alter table public.sentence_analysis_reports add constraint sentence_analysis_reports_content_type_check
  check (content_type in ('article','conversation','study_room'));

alter table public.sentence_analysis_reports drop constraint if exists sentence_analysis_reports_reason_check;
alter table public.sentence_analysis_reports add constraint sentence_analysis_reports_reason_check
  check (reason in ('translation','grammar','vocab','awkward','answer','other'));

create or replace function public.report_sentence_analysis(
  p_content_type text,
  p_content_id   text,
  p_sent_idx     integer,
  p_sentence     text,
  p_reason       text,
  p_detail       text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_today int;
  v_id bigint;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if p_content_type not in ('article','conversation','study_room') then
    return jsonb_build_object('ok', false, 'error', 'invalid_content_type');
  end if;
  if p_reason not in ('translation','grammar','vocab','awkward','answer','other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_reason');
  end if;
  if coalesce(btrim(p_content_id), '') = '' or coalesce(btrim(p_sentence), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_target');
  end if;

  select count(*) into v_today from public.sentence_analysis_reports
   where reporter_id = v_user and created_at > now() - interval '24 hours';
  if v_today >= 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into public.sentence_analysis_reports
    (content_type, content_id, sent_idx, sentence, reason, detail, reporter_id)
  values
    (p_content_type, left(btrim(p_content_id), 100), p_sent_idx, left(btrim(p_sentence), 1000),
     p_reason, nullif(left(btrim(coalesce(p_detail, '')), 500), ''), v_user)
  on conflict (content_type, content_id, sentence, reporter_id) where status = 'pending'
  do update set reason = excluded.reason, detail = excluded.detail, created_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke execute on function public.report_sentence_analysis(text, text, integer, text, text, text) from public;
grant  execute on function public.report_sentence_analysis(text, text, integer, text, text, text) to authenticated;
