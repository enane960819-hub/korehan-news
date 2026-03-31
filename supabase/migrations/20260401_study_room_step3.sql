-- ─────────────────────────────────────────────────────────────────────
-- Study Room: global topic scheduling + Image Description 3-step content
-- ─────────────────────────────────────────────────────────────────────

-- 1. Add Step-1 (vocab) and Step-3 (incorrect sentences) columns to
--    study_picture_prompts.
ALTER TABLE study_picture_prompts
  ADD COLUMN IF NOT EXISTS vocab_items          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS incorrect_sentences  JSONB DEFAULT '[]'::jsonb;

-- 2. Global topic schedule table.
--    One row per (date, level) — same topic shown to ALL users.
CREATE TABLE IF NOT EXISTS study_topic_schedule (
  scheduled_date  DATE    NOT NULL,
  level           TEXT    NOT NULL,
  topic_id        TEXT    NOT NULL,   -- matches writing_topics.id (cast as text for safety)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (scheduled_date, level)
);

ALTER TABLE study_topic_schedule ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for the study room page, anonymous users)
CREATE POLICY "study_topic_schedule_select"
  ON study_topic_schedule FOR SELECT USING (true);

-- Only authenticated (admin) users can write
CREATE POLICY "study_topic_schedule_write"
  ON study_topic_schedule FOR ALL USING (true) WITH CHECK (true);
