-- ═══════════════════════════════════════════════════════════
-- Stories v2: Add genre, perspective, series, character fields
-- 2026-04-12
-- ═══════════════════════════════════════════════════════════

-- Add new columns to stories_data
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT 'slice_of_life';
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS perspective TEXT DEFAULT 'third';
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS series_id TEXT;
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS episode INT DEFAULT 0;
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS episode_title TEXT;
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS character_slugs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS cliffhanger TEXT;
ALTER TABLE stories_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for series lookup
CREATE INDEX IF NOT EXISTS idx_stories_series ON stories_data (series_id, episode);
CREATE INDEX IF NOT EXISTS idx_stories_genre ON stories_data (genre);

-- Series metadata table
CREATE TABLE IF NOT EXISTS story_series (
  id TEXT PRIMARY KEY,  -- e.g. 'newsroom-secret'
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  genre TEXT DEFAULT 'mystery',
  character_slugs JSONB DEFAULT '[]'::jsonb,
  cover_image TEXT,
  total_episodes INT DEFAULT 0,
  status TEXT DEFAULT 'ongoing',  -- 'ongoing', 'completed'
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE story_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_series_read" ON story_series FOR SELECT USING (true);
CREATE POLICY "story_series_admin" ON story_series FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
