-- ═══════════════════════════════════════════════════════════════
-- Fast Track: User scenario progress tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fast_track_progress (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id   text NOT NULL,
  visited_nodes text[] DEFAULT '{}',
  best_path     text[] DEFAULT '{}',
  phrases       text[] DEFAULT '{}',
  completion_pct smallint DEFAULT 0,
  play_count    int DEFAULT 0,
  best_score    int DEFAULT 0,
  last_played   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_ftp_user ON fast_track_progress (user_id, last_played DESC);

ALTER TABLE fast_track_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ftp_users_read_own" ON fast_track_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ftp_users_insert_own" ON fast_track_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ftp_users_update_own" ON fast_track_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ftp_service_full" ON fast_track_progress FOR ALL USING (auth.role() = 'service_role');
