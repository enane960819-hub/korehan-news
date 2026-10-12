-- Read-only: can we generate story covers? (key presence only, never value)
select json_build_object(
  'openai_key_set', exists (select 1 from public.app_settings where key='openai_key' and coalesce(value,'')<>''),
  'bucket_story_illustrations', exists (select 1 from storage.buckets where id='story-illustrations'),
  'stories', (select count(*) from public.stories_data)
) as report;
