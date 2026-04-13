-- vocabulary_game_packs: 게임용 단어 팩 테이블
-- Word Drop, Memory Match 등 playground 게임에서 사용

CREATE TABLE IF NOT EXISTS vocabulary_game_packs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_name TEXT NOT NULL,              -- "Food", "Travel", "TOPIK 1" 등
  pack_icon TEXT DEFAULT '📦',          -- emoji icon
  category TEXT DEFAULT 'general',      -- 분류: general, topik, custom
  difficulty TEXT DEFAULT 'normal',     -- easy, normal, hard
  words JSONB NOT NULL DEFAULT '[]',    -- [{ko:"친구", en:"friend"}, ...]
  word_count INT GENERATED ALWAYS AS (jsonb_array_length(words)) STORED,
  is_default BOOLEAN DEFAULT false,     -- 기본 팩 여부 (삭제 불가)
  is_active BOOLEAN DEFAULT true,       -- 비활성화 가능
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_vgp_active ON vocabulary_game_packs (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vgp_category ON vocabulary_game_packs (category);

-- RLS: 누구나 읽기 가능, 수정은 인증된 사용자만
ALTER TABLE vocabulary_game_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active packs" ON vocabulary_game_packs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can insert" ON vocabulary_game_packs
  FOR INSERT TO authenticated WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_vgp_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vgp_updated_at
  BEFORE UPDATE ON vocabulary_game_packs
  FOR EACH ROW EXECUTE FUNCTION update_vgp_timestamp();

-- 유저별 게임 최고 점수 테이블 (리더보드용)
CREATE TABLE IF NOT EXISTS user_game_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,              -- 'worddrop', 'chosung', 'memory', 'tetris', 'ox'
  score INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',          -- {mode:'ko2en', topic:'food', combo:12, level:8}
  played_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugs_user ON user_game_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_ugs_game ON user_game_scores (game_type);
CREATE INDEX IF NOT EXISTS idx_ugs_top ON user_game_scores (game_type, score DESC);

ALTER TABLE user_game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scores" ON user_game_scores
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scores" ON user_game_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Top scores view (리더보드)
CREATE OR REPLACE VIEW game_leaderboard AS
SELECT game_type, user_id, MAX(score) as best_score, COUNT(*) as play_count
FROM user_game_scores
GROUP BY game_type, user_id
ORDER BY best_score DESC;
