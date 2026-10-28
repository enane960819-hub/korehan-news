-- Where AI-made learner content lives and how much of it was ever reviewed (read-only).
select json_build_object(
  'gec_by_prefix', (select json_agg(t) from (
      select split_part(pattern_name, '::', 1) as prefix, count(*) n,
             count(*) filter (where patterns_json like '%"qa":true%') qa_true,
             max(updated_at)::date last
      from grammar_examples_cache group by 1 order by 2 desc limit 40) t),
  'article_cache_keys', (select json_agg(t) from (
      select content_type, cache_key, count(*) n, max(updated_at)::date last
      from article_cache group by 1,2 order by 3 desc limit 40) t),
  'vocab_bank', (select json_build_object('rows', count(*), 'no_rom', count(*) filter (where coalesce(word_rom,'')=''),
      'multi_meaning', count(*) filter (where word_en ~ '[,;/]'), 'long_meaning', count(*) filter (where length(word_en) > 40)) from vocabulary_bank),
  'hover_vocab', (select count(*) from hover_vocab_master),
  'tables', (select json_agg(t) from (
      select relname, n_live_tup from pg_stat_user_tables
      where relname in ('phrases','phrases_data','slang_entries','fast_track_scenarios','conversations_data','stories_data','articles','essential_expressions','study_room_grammar','grammar_curriculum','study_daily_content','writing_topic_packs')
      order by 1) t),
  'gec_columns', (select json_agg(column_name) from information_schema.columns where table_name='grammar_examples_cache'),
  'ac_columns', (select json_agg(column_name) from information_schema.columns where table_name='article_cache'),
  'vb_columns', (select json_agg(column_name) from information_schema.columns where table_name='vocabulary_bank')
) as report;
