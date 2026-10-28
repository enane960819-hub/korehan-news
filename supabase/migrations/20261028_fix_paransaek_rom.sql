-- auto-apply
-- 파란색 was romanized "paramsaek" (reported from the article word bank).
-- Revised Romanization: paransaek. Idempotent.
update public.vocabulary_bank set word_rom = 'paransaek' where word_ko = '파란색' and word_rom is distinct from 'paransaek';
update public.user_saved_words set word_rom = 'paransaek' where word_ko = '파란색' and word_rom = 'paramsaek';
