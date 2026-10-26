-- Read-only: weekly study content for the current + next 3 weeks (what
-- learners will see in the writing room), for a naturalness review.
select json_build_object(
  'date_range', (select json_build_object('min', min(scheduled_date), 'max', max(scheduled_date), 'future', count(*) filter (where scheduled_date >= current_date - 7)) from public.study_daily_content),
  'rows', (select json_agg(json_build_object(
      'd', scheduled_date, 'lv', level, 'topic', topic_ko, 'status', status,
      'grammar', grammar, 'helpers', helpers, 'dict', dictation_sentences,
      'tws', topic_writing_sentences, 'kx', key_expressions) order by scheduled_date, level)
    from public.study_daily_content
    where scheduled_date between current_date - 7 and current_date + 21)
);
