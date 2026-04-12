-- ═══════════════════════════════════════════════════════════
-- User Subscriptions table
-- 2026-04-12
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',  -- 'free', 'standard', 'pro'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_provider TEXT DEFAULT 'manual',  -- 'manual', 'stripe', etc.
  payment_id TEXT,  -- external payment reference
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "user_sub_read_own" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin (service_role) can do everything
CREATE POLICY "user_sub_admin" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_user_sub_user ON user_subscriptions (user_id);
CREATE INDEX idx_user_sub_plan ON user_subscriptions (plan, status);
