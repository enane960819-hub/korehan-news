-- grammar_curriculum v2 verification (read-only).
select json_build_object(
  'active_total', (select count(*) from public.grammar_curriculum where active),
  'inactive_total', (select count(*) from public.grammar_curriculum where not active),
  'by_level_tier', (select json_agg(x) from (
      select level, tier, count(*) n from public.grammar_curriculum where active group by level, tier order by level, tier) x),
  'dup_patterns', (select count(*) from (select pattern from public.grammar_curriculum group by pattern having count(*) > 1) d),
  'cached_lessons_v2', (select count(*) from public.grammar_examples_cache where pattern_name like 'gf-curr2::%'),
  'update_policy', (select qual from pg_policies where tablename = 'grammar_examples_cache' and policyname = 'grammar_examples_cache auth update')
) as report;
