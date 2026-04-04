-- ═══════════════════════════════════════════════════════════════
-- Unified User Submissions Table
-- Replaces: writing_submissions, article_study_submissions
-- Supports: writing, article_study, conversation, story (+ future types)
-- Flow: submitted → ai_reviewed → admin_approved → sent
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_submissions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Who & When ──
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- ── Content Type & Reference ──
  content_type  text NOT NULL CHECK (content_type IN (
    'writing',           -- Study Room daily topic writing
    'article_study',     -- Article Study step5 free writing
    'conversation',      -- Conversation lesson writing (future)
    'story'              -- Story lesson writing (future)
  )),
  content_id    text,                -- article_id, conversation_id, story_id, etc. (nullable for daily writing)
  content_title text DEFAULT '',     -- article title, conversation name, etc.
  study_date    date NOT NULL DEFAULT CURRENT_DATE,

  -- ── User's Writing ──
  writing_text  text NOT NULL DEFAULT '',
  word_count    int DEFAULT 0,

  -- ── Context (topic, vocab, grammar for the assignment) ──
  topic_ko      text DEFAULT '',
  topic_en      text DEFAULT '',
  writing_mode  text DEFAULT 'topic',
  context_data  jsonb DEFAULT '{}',  -- flexible: used_vocab, required_vocab, used_grammar, required_grammar, step4_answers, etc.

  -- ── Review Pipeline ──
  -- submitted → ai_reviewed → admin_approved → sent
  status        text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',        -- user just submitted
    'ai_reviewed',      -- AI feedback generated
    'admin_approved',   -- admin reviewed & approved
    'sent'              -- feedback delivered to user
  )),

  -- ── AI Feedback (1st pass) ──
  ai_feedback       jsonb,           -- structured AI feedback (corrections, patterns, encouragement)
  ai_feedback_at    timestamptz,
  ai_model          text,            -- which model was used

  -- ── Admin Review (2nd pass) ──
  admin_feedback    text,            -- admin's edited/additional feedback text
  admin_user_id     uuid,            -- which admin reviewed
  reviewed_at       timestamptz,

  -- ── Delivery ──
  sent_at           timestamptz,     -- when feedback was sent to user

  -- ── Scoring ──
  score             smallint CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  level             text,            -- user's level at time of submission (Starter/Beginner/Intermediate/Advanced)

  -- ── Prevent duplicate submissions ──
  UNIQUE (user_id, content_type, study_date, content_id)
);

-- ── Indexes for common queries ──
CREATE INDEX IF NOT EXISTS idx_us_user_date      ON user_submissions (user_id, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_us_status         ON user_submissions (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_us_type_date      ON user_submissions (content_type, study_date DESC);
CREATE INDEX IF NOT EXISTS idx_us_admin_pending   ON user_submissions (status, content_type) WHERE status IN ('submitted', 'ai_reviewed');

-- ── RLS ──
ALTER TABLE user_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own submissions
CREATE POLICY "users_read_own_submissions" ON user_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own submissions
CREATE POLICY "users_insert_own_submissions" ON user_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own submissions (for AI feedback update)
CREATE POLICY "users_update_own_submissions" ON user_submissions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role (admin) can do everything
CREATE POLICY "service_role_full_access" ON user_submissions
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE user_submissions IS 'Unified table for all user writing submissions across content types. Flow: submitted → ai_reviewed → admin_approved → sent';
