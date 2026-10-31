-- auto-apply
-- New reporter portraits from the owner (2026-10-31): 한다온 (cr2, the hedgehog reporter is now
-- a person) and 송유나 (cr6, replaces the picsum placeholder). Art ships with the site in
-- korehan/assets/reporters/ (versioned file names: /assets is cached for a year, so a new
-- drawing gets a new name, never an overwrite). The old hedgehog picture stays in Storage as
-- the style reference for the 모래 mascot. Idempotent.
update public.character_reporters
   set data = jsonb_set(data, '{image}', to_jsonb('https://korehani.com/assets/reporters/cr2-v1.webp'::text)), updated_at = now()
 where id = 'cr2' and coalesce(data->>'image', '') <> 'https://korehani.com/assets/reporters/cr2-v1.webp';
update public.character_reporters
   set data = jsonb_set(data, '{image}', to_jsonb('https://korehani.com/assets/reporters/cr6-v1.webp'::text)), updated_at = now()
 where id = 'cr6' and coalesce(data->>'image', '') <> 'https://korehani.com/assets/reporters/cr6-v1.webp';
