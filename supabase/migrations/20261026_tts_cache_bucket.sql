-- auto-apply
-- Public Storage bucket for synthesized pronunciation audio. tts-proxy
-- uploads each (voice, text) clip once with the service role; clients
-- read the public URL first, so a word is synthesized once for everyone
-- instead of on every tap. Writes: service role only (no client policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-cache', 'tts-cache', true, 1048576, array['audio/mpeg'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
