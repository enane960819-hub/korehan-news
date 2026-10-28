-- auto-apply
-- Read model for the Word Bank page: bank words + their topic, filterable by
-- level and tag in one PostgREST query. security_invoker so the base tables'
-- public-read RLS applies. Idempotent.
create or replace view public.word_bank with (security_invoker = true) as
  select v.id, v.word_ko, coalesce(v.word_rom, '') as word_rom, v.word_en, v.level,
         v.pos, v.example_ko, v.source, t.tag
    from public.vocabulary_bank v
    left join public.word_tags t on t.word_ko = v.word_ko
   where v.is_active and coalesce(v.word_en, '') <> '' and coalesce(v.word_ko, '') <> '';
grant select on public.word_bank to anon, authenticated;
