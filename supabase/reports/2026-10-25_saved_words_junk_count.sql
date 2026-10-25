-- Read-only: how many user_saved_words rows look auto-inserted by review
-- flows (save_or_update_word from flashcards / quizzes / memory game)
-- rather than chosen by the learner. Nothing is deleted here — owner
-- decides on cleanup after seeing these numbers.
select json_build_object(
  'total', (select count(*) from public.user_saved_words),
  'users', (select count(distinct user_id) from public.user_saved_words),
  'by_source_kind', (select json_object_agg(coalesce(source_kind, '(null)'), n) from (
      select source_kind, count(*) n from public.user_saved_words group by 1 order by 2 desc) x),
  'multi_word', (select count(*) from public.user_saved_words where word_ko ~ '\s'),
  'long_gt8', (select count(*) from public.user_saved_words where char_length(word_ko) > 8),
  'placeholder_words', (select count(*) from public.user_saved_words
                         where word_ko in ('뉴스','사회','국제','문화','한국','학교')),
  'sample_multi_word', (select coalesce(json_agg(x), '[]'::json) from (
      select word_ko, source_kind, to_char(created_at at time zone 'Asia/Seoul','MM-DD') d
        from public.user_saved_words where word_ko ~ '\s' order by created_at desc limit 15) x)
);
