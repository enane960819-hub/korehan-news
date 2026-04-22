-- Article video support — lets a source video (YouTube embed or r/v.redd.it hosted
-- MP4) stand in for the hero image on the article detail page. The admin source-
-- fetch pipeline extracts these from Reddit posts and ALWAYS persists them when
-- present, even if the admin unchecked 'Use video' at creation. The use_video
-- flag is what the renderer checks, so an admin can flip an older article from
-- image to video later without losing the upstream URL.
--
-- All three columns are nullable. video_url holds the YouTube embed URL or the
-- v.redd.it fallback MP4 URL. video_kind is 'youtube' or 'reddit' so the renderer
-- knows which element to emit (iframe vs. <video>). use_video is true when the
-- admin wants the hero to be the video, false when they want the image fallback.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_kind text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS use_video boolean;
-- Silent MP4 fallback for Reddit HLS videos. HLS on v.redd.it frequently
-- fails (CORS / expired signatures), so when the renderer can't load the
-- HLS manifest it degrades to this URL and keeps video playing without
-- audio. Null for YouTube embeds and for rows created before this column.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS video_fallback_url text;
