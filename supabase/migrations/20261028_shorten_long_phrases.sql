-- auto-apply
-- Two of the original Today's Phrase entries carried long AI-written
-- meaning / usage paragraphs (and no Korean meaning). Replace them with
-- short hand-written text matching the rest of the list. Matched by ko,
-- order unchanged, so the rotation doesn't move. Idempotent.
update public.app_settings s
   set value = (
     select jsonb_agg(
       case e->>'ko'
         when '고생 끝에 낙이 온다' then e || jsonb_build_object(
           'en', 'After hardship comes happiness.',
           'intro', 'Good things come after a hard time.',
           'intro_ko', '힘든 일을 견디면 좋은 일이 온다는 뜻이에요.',
           'nuance', 'Used to cheer someone up during a tough time.',
           'level', 'Sprout')
         when '티끌 모아 태산' then e || jsonb_build_object(
           'rom', 'Tikkeul moa taesan',
           'en', 'Dust gathered becomes a mountain.',
           'intro', 'Small things add up to something big.',
           'intro_ko', '작은 것도 모이면 큰 것이 된다는 뜻이에요.',
           'nuance', 'Used about saving money or steady daily effort.',
           'level', 'Sprout')
         else e end
       order by ord)
     from jsonb_array_elements(s.value::jsonb) with ordinality as t(e, ord)
   )
 where s.key = 'phrases'
   and exists (select 1 from jsonb_array_elements(s.value::jsonb) e
                where e->>'ko' in ('고생 끝에 낙이 온다', '티끌 모아 태산')
                  and length(coalesce(e->>'intro', '')) > 60);
