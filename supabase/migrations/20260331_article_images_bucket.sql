-- ─────────────────────────────────────────────────────────────
-- Storage bucket for admin-uploaded article images
-- Run this in the Supabase SQL editor (or Storage dashboard)
-- ─────────────────────────────────────────────────────────────

-- 1. Create public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  10485760,  -- 10 MB max per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Public read (anyone can view images)
CREATE POLICY "article_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-images');

-- 3. Admin-only write (service role key used by admin panel)
CREATE POLICY "article_images_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'article-images' AND auth.role() = 'service_role');

CREATE POLICY "article_images_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'article-images' AND auth.role() = 'service_role');

CREATE POLICY "article_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'article-images' AND auth.role() = 'service_role');

-- Note: the articles.image column already exists as type text.
-- No schema changes needed — uploaded image URLs are stored in articles.image.
