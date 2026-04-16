-- ─────────────────────────────────────────────────────────────
-- Add thumbnail and video_url columns to articles table
-- + Update article-images bucket to allow video uploads
-- Run this in the Supabase SQL editor
-- ─────────────────────────────────────────────────────────────

-- 1. Add thumbnail column (separate image for card/list views)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS thumbnail TEXT;

-- 2. Add video_url column (direct video URL, shown instead of hero image)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 3. Update article-images bucket to also accept video files
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime'
],
file_size_limit = 104857600  -- 100 MB for video files
WHERE id = 'article-images';
