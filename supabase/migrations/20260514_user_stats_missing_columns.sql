-- user_stats: add the four columns the frontend writes/reads without
-- a matching column definition. Every upsert that included these
-- silently rolled back the rest of the payload alongside them.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS fill_done         int      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mission_date text     DEFAULT '',
  ADD COLUMN IF NOT EXISTS writing_tickets   int      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferences       jsonb    DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
