-- ─────────────────────────────────────────────────────────────────────
-- Study Room: AI-generated daily content table + picture prompt columns
-- (This supersedes 20260401_study_room_step3.sql which was never run)
-- ─────────────────────────────────────────────────────────────────────

-- 1. Add Step-1 vocab and Step-3 incorrect-sentences columns to
--    study_picture_prompts (idempotent — safe to run twice).
ALTER TABLE study_picture_prompts
  ADD COLUMN IF NOT EXISTS vocab_items          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS incorrect_sentences  JSONB DEFAULT '[]'::jsonb;

-- 2. Global topic schedule (kept for reference / backward compat).
CREATE TABLE IF NOT EXISTS study_topic_schedule (
  scheduled_date  DATE    NOT NULL,
  level           TEXT    NOT NULL,
  topic_id        TEXT    NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (scheduled_date, level)
);

ALTER TABLE study_topic_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_topic_schedule_select" ON study_topic_schedule;
CREATE POLICY "study_topic_schedule_select"
  ON study_topic_schedule FOR SELECT USING (true);

DROP POLICY IF EXISTS "study_topic_schedule_write" ON study_topic_schedule;
CREATE POLICY "study_topic_schedule_write"
  ON study_topic_schedule FOR ALL USING (true) WITH CHECK (true);

-- 3. NEW: study_daily_content — one row per (date, level).
--    Stores the AI-generated (or admin-edited) topic + all study content.
CREATE TABLE IF NOT EXISTS study_daily_content (
  scheduled_date       DATE    NOT NULL,
  level                TEXT    NOT NULL,
  topic_ko             TEXT    DEFAULT '',
  topic_en             TEXT    DEFAULT '',
  vocab                JSONB   DEFAULT '[]'::jsonb,
  grammar              JSONB   DEFAULT '[]'::jsonb,
  helpers              JSONB   DEFAULT '[]'::jsonb,
  dictation_sentences  JSONB   DEFAULT '[]'::jsonb,
  dictation_questions  JSONB   DEFAULT '[]'::jsonb,
  admin_edited         BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (scheduled_date, level)
);

ALTER TABLE study_daily_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_daily_content_select" ON study_daily_content;
CREATE POLICY "study_daily_content_select"
  ON study_daily_content FOR SELECT USING (true);

DROP POLICY IF EXISTS "study_daily_content_write" ON study_daily_content;
CREATE POLICY "study_daily_content_write"
  ON study_daily_content FOR ALL USING (true) WITH CHECK (true);
