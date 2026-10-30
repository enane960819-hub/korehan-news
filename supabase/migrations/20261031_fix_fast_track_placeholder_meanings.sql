-- auto-apply
-- Saved words whose meaning was the placeholder "[표현] Fast Track expression"
-- (written by old Fast Track save code that no longer exists): the daily review
-- showed that as the answer (tester report 2026-10-30). 5 rows, 2 phrases.
update public.user_saved_words
   set word_en = case word_ko
                   when '혼자예요'    then '[표현] I''m alone; it''s just me (one person)'
                   when '추천해주세요' then '[표현] Please recommend something'
                 end
 where word_en = '[표현] Fast Track expression'
   and word_ko in ('혼자예요', '추천해주세요');
