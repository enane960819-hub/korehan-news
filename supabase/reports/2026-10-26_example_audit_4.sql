-- Read-only: Intermediate/Advanced grammar_curriculum examples + the
-- grammar_examples_cache (used when a lesson has no examples_json).
select json_build_object(
  'gc', (select json_agg(json_build_array(id, level, pattern, examples_json) order by level, sort_order)
           from public.grammar_curriculum where active and level in ('Intermediate', 'Advanced')
             and coalesce(examples_json, '') not in ('', '[]')),
  'gc_empty', (select count(*) from public.grammar_curriculum where active and coalesce(examples_json, '') in ('', '[]')),
  'cache_n', (select count(*) from public.grammar_examples_cache),
  'cache', (select json_agg(json_build_array(pattern_name, left(patterns_json, 2500)) order by updated_at desc)
              from (select * from public.grammar_examples_cache order by updated_at desc limit 60) c)
);
