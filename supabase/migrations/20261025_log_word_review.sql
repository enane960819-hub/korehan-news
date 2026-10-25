-- auto-apply
-- log_word_review: record a review of a word the learner ALREADY saved.
--
-- Why: every review/quiz UI (3D flashcards, Word Book quiz, conversation
-- flashcards, Memory game, listening quiz) called save_or_update_word,
-- which INSERTS the word when it isn't saved yet. Flicking through a deck
-- of random news vocab therefore filled learners' word books with words
-- they never chose (e.g. 공기 정화 시스템). Reviews must never insert.
--
-- This function only UPDATEs the caller's existing row (RLS owner-only
-- update policy applies — SECURITY INVOKER) and, unless p_schedule is
-- false, advances a simple SM-2 schedule so these reviews finally move
-- srs_next_review (most review UIs only bumped counters before).
-- Returns true when a saved word was updated, false otherwise.
-- Dates are KST, matching the rest of the app. Idempotent.

create or replace function public.log_word_review(
  p_word_key text,
  p_correct  boolean,
  p_schedule boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  n int;
begin
  if auth.uid() is null or p_word_key is null or length(p_word_key) = 0 then
    return false;
  end if;

  update public.user_saved_words w
     set review_count     = coalesce(w.review_count, 0) + 1,
         correct_count    = coalesce(w.correct_count, 0) + case when p_correct then 1 else 0 end,
         wrong_count      = coalesce(w.wrong_count, 0)   + case when p_correct then 0 else 1 end,
         last_reviewed_at = now(),
         updated_at       = now(),
         srs_review_count = case when p_schedule then coalesce(w.srs_review_count, 0) + 1 else w.srs_review_count end,
         srs_last_reviewed = case when p_schedule then now() else w.srs_last_reviewed end,
         srs_ease_factor  = case when not p_schedule then w.srs_ease_factor
                                 when p_correct then least(2.8, coalesce(w.srs_ease_factor, 2.5) + 0.1)
                                 else greatest(1.3, coalesce(w.srs_ease_factor, 2.5) - 0.2) end,
         srs_interval     = case when not p_schedule then w.srs_interval
                                 when p_correct then greatest(1, round(coalesce(nullif(w.srs_interval, 0), 1) * coalesce(w.srs_ease_factor, 2.5))::int)
                                 else 1 end,
         srs_next_review  = case when not p_schedule then w.srs_next_review
                                 when p_correct then v_today + greatest(1, round(coalesce(nullif(w.srs_interval, 0), 1) * coalesce(w.srs_ease_factor, 2.5))::int)
                                 else v_today + 1 end
   where w.user_id = auth.uid()
     and (w.word_key = p_word_key or w.word_ko = p_word_key);

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function public.log_word_review(text, boolean, boolean) from public, anon;
grant execute on function public.log_word_review(text, boolean, boolean) to authenticated;
