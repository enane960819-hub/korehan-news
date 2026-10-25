-- Read-only: how many Grammar Path lessons are already saved (no AI needed)
-- vs. would need a live AI call (fails while Anthropic credits are empty).
with cur as (
  select pattern, level, unit from public.grammar_curriculum where active
), cached as (
  select replace(pattern_name, 'gf-curr2::', '') as pattern
    from public.grammar_examples_cache where pattern_name like 'gf-curr2::%'
)
select json_build_object(
  'active_patterns', (select count(*) from cur),
  'cached', (select count(*) from cur where pattern in (select pattern from cached)),
  'missing_by_level', (select json_object_agg(level, n) from (
      select level, count(*) n from cur where pattern not in (select pattern from cached) group by 1) x),
  'missing_starter', (select json_agg(pattern) from cur where level = 'Starter' and pattern not in (select pattern from cached)),
  'study_room_grammar_rows', (select count(*) from public.study_room_grammar),
  'srg_sample', (select json_agg(x) from (select pattern, level, left(example_ko, 40) ko from public.study_room_grammar limit 5) x)
);
