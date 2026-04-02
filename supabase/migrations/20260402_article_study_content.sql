-- article_study_content: admin-editable per-article study content
-- Takes priority over AI-generated content in the study room

CREATE TABLE IF NOT EXISTS article_study_content (
  article_id        TEXT PRIMARY KEY,
  article_title     TEXT,
  vocab             JSONB DEFAULT '[]',
  phrases           JSONB DEFAULT '[]',
  word_order        JSONB DEFAULT '[]',
  questions         JSONB DEFAULT '[]',
  custom_highlights JSONB,   -- {vocab: string[], phrases: string[]}
  admin_edited      BOOLEAN DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- RLS: allow all authenticated reads, admin writes only (use service role key from admin panel)
ALTER TABLE article_study_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON article_study_content
  FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON article_study_content
  USING (true) WITH CHECK (true);

COMMENT ON TABLE article_study_content IS
  'Admin-edited study content per article. Overrides AI-generated content when admin_edited=true.';
