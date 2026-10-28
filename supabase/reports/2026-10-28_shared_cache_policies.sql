-- Who may write the shared AI caches (live policies), to plan moving those writes server-side.
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('article_cache','article_study_content','grammar_examples_cache','vocabulary_bank','hover_vocab_master','grammar_lesson_cache')
order by tablename, cmd, policyname;
