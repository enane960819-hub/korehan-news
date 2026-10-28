-- auto-apply
-- The first pack attempts were rejected by reviewer bugs fixed in #841
-- (flags that said "this is fine", glosses deleting options), not by bad
-- content — give those topics their attempts back. Idempotent.
delete from public.content_qa_runs where key like 'pack::%' and updated_at < '2026-10-28T02:30:00+00';
