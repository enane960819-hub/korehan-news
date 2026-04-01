-- ─────────────────────────────────────────────────────────────────────
-- Article Study: submission tracking table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS article_study_submissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id      TEXT NOT NULL,
  article_title   TEXT DEFAULT '',
  study_date      DATE NOT NULL,
  step4_content   TEXT DEFAULT '',
  step5_content   TEXT DEFAULT '',
  submitted       BOOLEAN DEFAULT FALSE,
  auto_submitted  BOOLEAN DEFAULT FALSE,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, article_id, study_date)
);

ALTER TABLE article_study_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "article_study_select"
    ON article_study_submissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "article_study_insert"
    ON article_study_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "article_study_update"
    ON article_study_submissions FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
