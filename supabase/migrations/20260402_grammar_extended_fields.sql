-- Add extended grammar fields to study_room_grammar
-- These power the "Learn" tab in Grammar Focus modal

ALTER TABLE study_room_grammar
  ADD COLUMN IF NOT EXISTS structure   text,
  ADD COLUMN IF NOT EXISTS when_to_use text,
  ADD COLUMN IF NOT EXISTS watch_out   text;

COMMENT ON COLUMN study_room_grammar.structure   IS 'Grammatical structure notation, e.g. "동사 어간 + 아요/어요"';
COMMENT ON COLUMN study_room_grammar.when_to_use IS 'When/where to use this grammar point';
COMMENT ON COLUMN study_room_grammar.watch_out   IS 'Common mistakes or exceptions to watch out for';
