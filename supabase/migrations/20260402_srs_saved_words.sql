-- SRS (Spaced Repetition System) fields for saved_words
-- SM-2 algorithm: interval (days), ease_factor, next_review_date, review_count

ALTER TABLE saved_words
  ADD COLUMN IF NOT EXISTS srs_interval       INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_ease_factor    FLOAT       DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_next_review    DATE        DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS srs_review_count   INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_last_reviewed  TIMESTAMPTZ;

-- Index for efficient due-word queries
CREATE INDEX IF NOT EXISTS idx_saved_words_srs_review
  ON saved_words (user_id, srs_next_review);
