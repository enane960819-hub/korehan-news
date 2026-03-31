-- ─────────────────────────────────────────────────────────────
-- Study Room DB-backed content: Quick Help + Grammar + Picture upgrades
-- ─────────────────────────────────────────────────────────────

-- 1. Quick Help (빠른 도움) sentences, per level
CREATE TABLE IF NOT EXISTS study_room_helpers (
  id          uuid      DEFAULT gen_random_uuid() PRIMARY KEY,
  level       text      NOT NULL DEFAULT 'Beginner',  -- Starter | Beginner | Intermediate | Advanced
  ko          text      NOT NULL,
  en          text      NOT NULL,
  display_order int     DEFAULT 0,
  active      boolean   DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE study_room_helpers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "helpers_read_all"    ON study_room_helpers FOR SELECT USING (true);
CREATE POLICY "helpers_write_admin" ON study_room_helpers FOR ALL    USING (auth.role() = 'service_role');

-- 2. Grammar explanation items, per level
CREATE TABLE IF NOT EXISTS study_room_grammar (
  id           uuid   DEFAULT gen_random_uuid() PRIMARY KEY,
  level        text   NOT NULL DEFAULT 'Beginner',
  pattern      text   NOT NULL,
  explanation  text   NOT NULL,
  example_ko   text   NOT NULL,
  example_en   text   NOT NULL,
  display_order int   DEFAULT 0,
  active       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE study_room_grammar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grammar_read_all"    ON study_room_grammar FOR SELECT USING (true);
CREATE POLICY "grammar_write_admin" ON study_room_grammar FOR ALL    USING (auth.role() = 'service_role');

-- 3. Extend study_picture_prompts with scheduling + word-order + custom prompt
ALTER TABLE study_picture_prompts ADD COLUMN IF NOT EXISTS scheduled_date   date;
ALTER TABLE study_picture_prompts ADD COLUMN IF NOT EXISTS word_order_words jsonb DEFAULT '[]';
ALTER TABLE study_picture_prompts ADD COLUMN IF NOT EXISTS custom_prompt    text;

-- 4. Storage bucket: study-images (run this in Supabase dashboard if not created)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('study-images', 'study-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- Allow public read
-- CREATE POLICY "study_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'study-images');
-- Allow service role to upload
-- CREATE POLICY "study_images_admin_upload" ON storage.objects FOR INSERT USING (bucket_id = 'study-images' AND auth.role() = 'service_role');
-- CREATE POLICY "study_images_admin_update" ON storage.objects FOR UPDATE USING (bucket_id = 'study-images' AND auth.role() = 'service_role');
-- CREATE POLICY "study_images_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'study-images' AND auth.role() = 'service_role');
