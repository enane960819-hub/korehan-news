-- Read-only: shape of grammar_examples_cache (key expressions, situations…)
-- to plan a paged naturalness review.
select json_build_object(
  'by_prefix', (select json_agg(x) from (
      select split_part(pattern_name, '::', 1) prefix, count(*) n, sum(length(patterns_json)) bytes,
             max(updated_at) last_upd
        from public.grammar_examples_cache group by 1 order by 2 desc) x),
  'kex_sample', (select patterns_json from public.grammar_examples_cache where pattern_name like 'kex::%' order by updated_at desc limit 1),
  'kexsit_sample', (select patterns_json from public.grammar_examples_cache where pattern_name like 'kex_sit::%' order by updated_at desc limit 1)
);
