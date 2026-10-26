-- Read-only: grammar_curriculum example sentences (Starter + Beginner)
-- for a naturalness review.
select json_build_object(
  'levels', (select json_object_agg(level, n) from (select level, count(*) n from public.grammar_curriculum where active group by level) x),
  'rows', (select json_agg(json_build_array(id, level, pattern, examples_json) order by level, sort_order)
             from public.grammar_curriculum where active and level in ('Starter', 'Beginner'))
);
