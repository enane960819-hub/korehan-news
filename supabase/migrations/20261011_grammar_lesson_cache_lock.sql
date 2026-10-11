-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- grammar_examples_cache: curriculum lessons are first-writer-wins
-- ═════════════════════════════════════════════════════════════════════
-- Grammar Path lessons (pattern_name 'gf-curr2::<pattern>') are generated
-- by the first learner who opens a pattern and then shared by everyone.
-- The previous "auth update" policy let ANY signed-in user overwrite any
-- cached row, i.e. vandalise a shared lesson. Keep inserts open (that is
-- how the first learner saves it) but forbid updates to curriculum
-- lessons; the admin CMS (service role via admin-api) can still delete a
-- bad lesson so it regenerates on next open. Other cache keys keep their
-- current behaviour. Idempotent.

drop policy if exists "grammar_examples_cache auth update" on public.grammar_examples_cache;
create policy "grammar_examples_cache auth update"
  on public.grammar_examples_cache
  for update
  to authenticated
  using (pattern_name not like 'gf-curr2::%')
  with check (pattern_name not like 'gf-curr2::%');
