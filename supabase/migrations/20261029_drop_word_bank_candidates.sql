-- auto-apply
-- The extra Word Bank words were reviewed and imported
-- (20261029_word_bank_extra_1..3.sql), so the staging table is no longer
-- needed. scripts/word-bank/extra.py only writes it when a commit asks for
-- [stage-extra-words]; recreate it with 20261029_word_bank_candidates.sql then.
drop table if exists public.word_bank_candidates;
