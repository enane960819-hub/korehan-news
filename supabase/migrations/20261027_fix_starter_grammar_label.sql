-- auto-apply
-- Generated Starter content (week of 2026-10-26) labelled the "liking an
-- activity" pattern as ~(으)ㄹ 것을 좋아해요 — its own example (그림 그리는 것을
-- 좋아해요) uses ~는 것. Fix the label. Idempotent.
update public.study_daily_content
   set grammar = replace(grammar::text, '~(으)ㄹ 것을 좋아해요', '~는 것을 좋아해요')::jsonb
 where grammar::text like '%~(으)ㄹ 것을 좋아해요%';
