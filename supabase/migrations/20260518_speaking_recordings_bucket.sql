-- ─────────────────────────────────────────────────────────────
-- Storage bucket for user speaking-practice recordings
-- ─────────────────────────────────────────────────────────────
-- Audit 2026-05-18 #5: previously submitSpeaking() uploaded user
-- speaking-practice webm blobs into the 'avatars' bucket. That bucket
-- exists for user profile images, so mixing personal voice recordings
-- into it muddled RLS, storage quotas, and any backup / cleanup logic
-- that filters by bucket. Moving them to a dedicated bucket so per-user
-- isolation can be expressed in storage policies and so admin tooling
-- can scan / clean speaking content without touching avatars.
--
-- File naming convention (matches the existing submitSpeaking code):
--   speaking/<user_id>/<YYYY-MM-DD>_<timestamp>.webm
-- so the user-id is the first path segment for owner-isolated RLS.

-- 1. Create private bucket (signed URLs only — these are personal voice)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaking-recordings',
  'speaking-recordings',
  false,
  20971520,  -- 20 MB per file (typical 30-60s webm is well under this)
  ARRAY['audio/webm','audio/ogg','audio/mpeg','audio/mp3','audio/wav','audio/m4a']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Users can read / write only their own recordings.
-- Path layout: speaking/<user_id>/<filename>, so split_part(name, '/', 2)
-- pulls the user_id segment. owner = auth.uid() is the canonical
-- "this object belongs to me" check Supabase uploads stamp automatically.

CREATE POLICY "speaking_recordings_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'speaking-recordings'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

CREATE POLICY "speaking_recordings_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'speaking-recordings'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "speaking_recordings_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'speaking-recordings'
    AND auth.role() = 'authenticated'
    AND (
      owner = auth.uid()
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

-- 3. Service role keeps full access for admin / cleanup tooling.
CREATE POLICY "speaking_recordings_admin_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'speaking-recordings' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'speaking-recordings' AND auth.role() = 'service_role');

-- Note on backfill: existing recordings still sit under 'avatars' on the
-- 'speaking/<user_id>/...' prefix. They keep working for now (the
-- avatars bucket policies don't actively block them). To move them, run:
--
--   SELECT * FROM storage.objects
--   WHERE bucket_id = 'avatars' AND name LIKE 'speaking/%';
--
-- ... and copy via storage.from('avatars').download / .upload to the
-- new bucket, then delete. Not done automatically here because it
-- requires service-role and may be cheaper to just let history age out.
