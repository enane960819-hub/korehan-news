-- auto-apply
-- English descriptions for slang (foreign-learner audience). The card now
-- shows desc_en when present (Korean desc_text is no longer shown to learners).
-- Populated later by an admin batch; nullable so it's a no-op until then.
alter table public.korean_slangs add column if not exists desc_en text;
