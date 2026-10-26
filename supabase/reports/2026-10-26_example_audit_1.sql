-- Read-only: learner-facing Korean examples for a naturalness review
-- (writing room grammar/helpers, weekly topics, cache sizes).
select json_build_object(
  'sizes', json_build_object(
    'study_room_grammar', (select count(*) from public.study_room_grammar),
    'study_room_helpers', (select count(*) from public.study_room_helpers),
    'writing_topics', (select count(*) from public.writing_topics),
    'study_daily_content', (select count(*) from public.study_daily_content),
    'grammar_examples_cache', (select count(*) from public.grammar_examples_cache),
    'grammar_curriculum', (select count(*) from public.grammar_curriculum),
    'article_study_content', (select count(*) from public.article_study_content),
    'vocabulary_bank', (select count(*) from public.vocabulary_bank)),
  'cols', (select json_object_agg(table_name, cols) from (
      select table_name, json_agg(column_name order by ordinal_position) cols from information_schema.columns
       where table_schema = 'public' and table_name in ('study_room_grammar','study_room_helpers','writing_topics','study_daily_content','grammar_examples_cache','grammar_curriculum','vocabulary_bank')
       group by table_name) c),
  'srg', (select json_agg(row_to_json(g)) from (select * from public.study_room_grammar order by level, display_order limit 300) g),
  'srh', (select json_agg(row_to_json(h)) from (select * from public.study_room_helpers limit 200) h)
);
