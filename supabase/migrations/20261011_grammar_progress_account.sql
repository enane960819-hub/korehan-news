-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Grammar Path progress → per-account (was localStorage-only)
-- ═════════════════════════════════════════════════════════════════════
-- study_grammar_progress already exists (20260328_study_room_restructure)
-- with completed_at / attempt_count. Add the fields the Grammar Path needs
-- (correct count, mastery, last practiced) and two RPCs:
--   record_grammar_attempt(key, correct)  — one exercise answer
--   merge_grammar_progress(rows jsonb)    — one-time upload of the
--                                           progress a learner built up
--                                           in the browser before this
-- Mastery is decided server-side; the rule mirrors _GC_MASTERY_ATTEMPTS /
-- _GC_MASTERY_ACCURACY in korehan-study-room.js (keep them in sync).
-- Idempotent.

alter table public.study_grammar_progress
  add column if not exists correct_count     int not null default 0,
  add column if not exists mastered          boolean not null default false,
  add column if not exists last_practiced_at timestamptz;

create or replace function public.record_grammar_attempt(p_key text, p_correct boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_key  text := btrim(coalesce(p_key, ''));
  r public.study_grammar_progress%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if v_key = '' or length(v_key) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  insert into public.study_grammar_progress
    (user_id, grammar_key, attempt_count, correct_count, last_practiced_at, updated_at)
  values
    (v_user, v_key, 1, case when p_correct then 1 else 0 end, now(), now())
  on conflict (user_id, grammar_key) do update set
    attempt_count     = public.study_grammar_progress.attempt_count + 1,
    correct_count     = public.study_grammar_progress.correct_count + (case when p_correct then 1 else 0 end),
    last_practiced_at = now(),
    updated_at        = now()
  returning * into r;

  -- Mastery is sticky once earned. Rule: ≥1 attempt and ≥50% correct.
  if not r.mastered and r.attempt_count >= 1 and r.correct_count::numeric / r.attempt_count >= 0.5 then
    update public.study_grammar_progress set mastered = true
     where user_id = v_user and grammar_key = v_key
    returning * into r;
  end if;

  return jsonb_build_object('ok', true, 'attempts', r.attempt_count, 'correct', r.correct_count, 'mastered', r.mastered);
end;
$$;

revoke execute on function public.record_grammar_attempt(text, boolean) from public;
grant  execute on function public.record_grammar_attempt(text, boolean) to authenticated;

-- p_rows: [{"key":"~아/어요","attempts":3,"correct":2,"mastered":true,"last":"2026-10-01T..."}]
create or replace function public.merge_grammar_progress(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row  jsonb;
  v_n    int := 0;
  v_key  text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_rows');
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) limit 500 loop
    v_key := btrim(coalesce(v_row->>'key', ''));
    continue when v_key = '' or length(v_key) > 200;
    insert into public.study_grammar_progress
      (user_id, grammar_key, attempt_count, correct_count, mastered, last_practiced_at, updated_at)
    values (
      v_user, v_key,
      greatest(0, least(coalesce((v_row->>'attempts')::int, 0), 10000)),
      greatest(0, least(coalesce((v_row->>'correct')::int, 0), 10000)),
      coalesce((v_row->>'mastered')::boolean, false),
      nullif(v_row->>'last', '')::timestamptz,
      now()
    )
    on conflict (user_id, grammar_key) do update set
      attempt_count     = greatest(public.study_grammar_progress.attempt_count, excluded.attempt_count),
      correct_count     = greatest(public.study_grammar_progress.correct_count, excluded.correct_count),
      mastered          = public.study_grammar_progress.mastered or excluded.mastered,
      last_practiced_at = greatest(public.study_grammar_progress.last_practiced_at, excluded.last_practiced_at),
      updated_at        = now();
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'merged', v_n);
end;
$$;

revoke execute on function public.merge_grammar_progress(jsonb) from public;
grant  execute on function public.merge_grammar_progress(jsonb) to authenticated;
