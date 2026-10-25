-- auto-apply
-- Fix nightly-harvest label → lesson links found wrong in the 2026-10-26
-- audit (article "Practice in Study Room" opened an unrelated lesson).
-- Idempotent.
update public.grammar_label_map set pattern = '(으)로 — By / Toward', verdict = 'existing'
 where label = '~(으)로 유명해졌어요 (famous for)';
update public.grammar_label_map set pattern = null, verdict = 'skip'
 where label_norm like '%스럽다%' and pattern like '%것 같다%';
