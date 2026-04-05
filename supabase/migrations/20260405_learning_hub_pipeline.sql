-- ═══════════════════════════════════════════════════════════════
-- Learning Hub Data Pipeline - Phase 1
-- New tables + indexes for growth tracking & analytics
-- ═══════════════════════════════════════════════════════════════

-- 1) 통합 활동 로그 (모든 학습 이벤트를 한 곳에)
-- 기존 xp_log / read_articles / daily_missions 와 별도로,
-- 분석용 이벤트 스트림
CREATE TABLE IF NOT EXISTS user_activity_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'read','quiz','word_save','writing_submit','dictation','grammar_practice','picture_desc'
  content_type  text,          -- 'article','conversation','story','daily_topic', etc.
  content_id    text,
  content_title text DEFAULT '',
  score         int,           -- nullable, for quizzes
  max_score     int,
  metadata      jsonb DEFAULT '{}',
  study_date    date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ual_user_date ON user_activity_log (user_id, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_ual_user_type ON user_activity_log (user_id, activity_type, created_at DESC);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ual_users_read_own" ON user_activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ual_users_insert_own" ON user_activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ual_service_full" ON user_activity_log FOR ALL USING (auth.role() = 'service_role');

-- 2) 퀴즈 결과 (점수 + 오답 패턴)
CREATE TABLE IF NOT EXISTS user_quiz_results (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_type     text NOT NULL, -- 'daily_review','grammar','vocab','dictation','article_comprehension','writing_feedback'
  content_type  text,
  content_id    text,
  score         int NOT NULL DEFAULT 0,
  max_score     int NOT NULL DEFAULT 100,
  accuracy_pct  smallint,      -- 0-100
  wrong_patterns jsonb DEFAULT '{}', -- {"PARTICLE":2,"TENSE":1,"WORD_ORDER":0,...}
  details       jsonb DEFAULT '{}', -- flexible: individual question results, etc.
  study_date    date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uqr_user_date ON user_quiz_results (user_id, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_uqr_user_type ON user_quiz_results (user_id, quiz_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uqr_patterns ON user_quiz_results USING gin (wrong_patterns);

ALTER TABLE user_quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uqr_users_read_own" ON user_quiz_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uqr_users_insert_own" ON user_quiz_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uqr_service_full" ON user_quiz_results FOR ALL USING (auth.role() = 'service_role');

-- 3) 주간 스냅샷 (매주 분석 데이터 캐시)
CREATE TABLE IF NOT EXISTS user_weekly_snapshot (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  week_end        date NOT NULL,
  xp_earned       int DEFAULT 0,
  articles_read   int DEFAULT 0,
  words_learned   int DEFAULT 0,
  quizzes_done    int DEFAULT 0,
  avg_quiz_accuracy smallint, -- 0-100
  writing_count   int DEFAULT 0,
  writing_avg_score smallint,
  skill_reading   smallint DEFAULT 0,
  skill_vocab     smallint DEFAULT 0,
  skill_grammar   smallint DEFAULT 0,
  skill_writing   smallint DEFAULT 0,
  skill_listening smallint DEFAULT 0,
  wrong_patterns  jsonb DEFAULT '{}',
  active_days     smallint DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_uws_user_week ON user_weekly_snapshot (user_id, week_start DESC);

ALTER TABLE user_weekly_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uws_users_read_own" ON user_weekly_snapshot FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uws_users_insert_own" ON user_weekly_snapshot FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uws_users_update_own" ON user_weekly_snapshot FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "uws_service_full" ON user_weekly_snapshot FOR ALL USING (auth.role() = 'service_role');

-- 4) 뱃지 정의 (어드민이 이미지 업로드해서 관리)
CREATE TABLE IF NOT EXISTS badges (
  id              text PRIMARY KEY, -- slug e.g. 'streak-7', 'words-100'
  name            text NOT NULL,
  description     text DEFAULT '',
  image_url       text,             -- Supabase Storage URL
  category        text DEFAULT 'milestone', -- milestone, streak, skill, special
  tier            text DEFAULT 'bronze', -- bronze, silver, gold, platinum, diamond
  unlock_condition jsonb DEFAULT '{}', -- {"type":"streak","value":7} or {"type":"words","value":100}
  room_asset_id   text,             -- link to room decoration item (nullable)
  sort_order      int DEFAULT 0,
  active          boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_public_read" ON badges FOR SELECT USING (true);
CREATE POLICY "badges_service_write" ON badges FOR ALL USING (auth.role() = 'service_role');

-- 5) 유저 뱃지 (서버 동기화)
CREATE TABLE IF NOT EXISTS user_badges (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    text NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  displayed   boolean DEFAULT false, -- 프로필 진열 여부
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_ub_user ON user_badges (user_id, earned_at DESC);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ub_users_read_own" ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ub_users_insert_own" ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ub_users_update_own" ON user_badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ub_service_full" ON user_badges FOR ALL USING (auth.role() = 'service_role');

-- 6) 주간 목표
CREATE TABLE IF NOT EXISTS user_weekly_goals (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  goal_articles   int DEFAULT 5,
  goal_words      int DEFAULT 20,
  goal_quizzes    int DEFAULT 10,
  goal_writing    int DEFAULT 3,
  goal_active_days int DEFAULT 5,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE user_weekly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uwg_users_read_own" ON user_weekly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uwg_users_insert_own" ON user_weekly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uwg_users_update_own" ON user_weekly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "uwg_service_full" ON user_weekly_goals FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE user_activity_log IS 'Unified event stream for all learning activities — reads, quizzes, word saves, writing, etc.';
COMMENT ON TABLE user_quiz_results IS 'Quiz scores with wrong-pattern analysis for error tracking over time';
COMMENT ON TABLE user_weekly_snapshot IS 'Cached weekly analytics — computed on access, stores skill scores and comparison data';
COMMENT ON TABLE badges IS 'Admin-managed badge definitions with custom images and unlock conditions';
COMMENT ON TABLE user_badges IS 'Server-synced badge awards per user — replaces localStorage-only tracking';
COMMENT ON TABLE user_weekly_goals IS 'User-set weekly learning targets for goal tracking';
