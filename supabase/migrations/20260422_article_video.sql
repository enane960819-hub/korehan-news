-- Article video support — lets a source video (YouTube embed or r/v.redd.it hosted
-- MP4) stand in for the hero image on the article detail page. The admin source-
-- fetch pipeline now extracts these from Reddit posts, and the admin "Use video"
-- toggle decides whether to persist them when an article is generated.
--
-- Both columns are nullable. video_url holds either the YouTube embed URL or the
-- v.redd.it fallback MP4 URL. video_kind is 'youtube' or 'reddit' so the renderer
-- knows which element to emit (iframe vs. <video>).
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_kind text;
