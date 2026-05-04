-- Stories: genre + optional source-text adaptation
--
-- The stories admin used to have a single `mood` field (slice_of_life,
-- romance, mystery, adventure, thriller, essay, workplace) — both the
-- tone AND the structural shape squeezed into one column. Adding
-- fairytale / web novel / folktale support means we want a clearer
-- structural axis ("genre") plus a way to capture WHERE the story
-- came from (original, public-domain Aesop / Grimm / Korean folktale,
-- pasted source) so admin can tell adapted content apart from
-- original generation later.
--
-- Doesn't touch the legacy `mood` column — backfilled into `genre` so
-- existing rows still classify correctly. New rows write both.

alter table public.stories_data
  add column if not exists genre          text,
  add column if not exists source_kind    text,    -- 'original' | 'aesop' | 'grimm' | 'korean_folktale' | 'public_domain'
  add column if not exists source_excerpt text;    -- short snippet of source if user pasted one

-- Backfill existing rows so filters/queries don't have a null gap.
update public.stories_data
   set genre = mood
 where genre is null and mood is not null;

create index if not exists stories_data_genre_idx
  on public.stories_data (genre) where genre is not null;
