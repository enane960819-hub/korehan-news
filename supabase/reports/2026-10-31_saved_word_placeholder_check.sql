-- Saved words whose meaning is a placeholder ("Fast Track expression" etc.) — read-only.
select jsonb_build_object(
  'top_meanings', (select jsonb_agg(jsonb_build_object('en', word_en, 'n', n)) from (
      select word_en, count(*) n from public.user_saved_words group by word_en order by count(*) desc limit 25) t),
  'placeholder_rows', (select count(*) from public.user_saved_words
      where word_en ~* '(fast ?track|expression|phrase|slang|saved from|from article|conversation)$' or word_en ~* '^(fast track|expression)'),
  'placeholder_samples', (select jsonb_agg(jsonb_build_object('ko', word_ko, 'en', word_en, 'src', source_kind)) from (
      select word_ko, word_en, source_kind from public.user_saved_words
       where word_en ~* 'fast ?track' or word_en ~* '^(expression|phrase)$' limit 40) s),
  'ft_tables', (select jsonb_agg(table_name) from information_schema.tables where table_schema='public' and table_name ilike '%fast%')
) as report;
