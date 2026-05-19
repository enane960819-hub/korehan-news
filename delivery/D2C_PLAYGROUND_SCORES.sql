-- =============================================================================
-- Item 2C — playground_scores
-- =============================================================================
-- Cross-device best-score persistence + lightweight leaderboard for the
-- playground games. Each user has one row per game (best-only); attempt
-- count is tracked but full history is not persisted.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS playground_scores (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug  TEXT        NOT NULL,
  best_score INT         NOT NULL DEFAULT 0,
  attempts   INT         NOT NULL DEFAULT 0,
  meta       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  first_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_slug)
);

CREATE INDEX IF NOT EXISTS playground_scores_game_top_idx
  ON playground_scores (game_slug, best_score DESC, last_at ASC);

ALTER TABLE playground_scores ENABLE ROW LEVEL SECURITY;

-- Leaderboards are public — anyone can SELECT.
DROP POLICY IF EXISTS playground_scores_read ON playground_scores;
CREATE POLICY playground_scores_read ON playground_scores FOR SELECT USING (TRUE);

-- =============================================================================
-- log_playground_score — single entry point for all games
-- =============================================================================
-- Bumps the best score if the new attempt beats it, otherwise just
-- increments attempts. Score is capped at 1,000,000 to avoid bad-client
-- or replay-attack stuffing. Always returns the user's resulting best,
-- so the client doesn't need a follow-up SELECT.
--
-- Returns: { ok: bool, error?, best?: int, new_best?: bool }

CREATE OR REPLACE FUNCTION log_playground_score(
  p_game_slug TEXT,
  p_score     INT,
  p_meta      JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_existing INT;
  v_new_best BOOLEAN := FALSE;
  v_score    INT := COALESCE(p_score, 0);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF p_game_slug IS NULL OR length(trim(p_game_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'INVALID_SLUG');
  END IF;
  IF v_score < 0 THEN v_score := 0; END IF;
  IF v_score > 1000000 THEN v_score := 1000000; END IF;

  SELECT best_score INTO v_existing
  FROM playground_scores
  WHERE user_id = v_uid AND game_slug = p_game_slug;

  IF v_existing IS NULL THEN
    INSERT INTO playground_scores (user_id, game_slug, best_score, attempts, meta, first_at, last_at)
    VALUES (v_uid, p_game_slug, v_score, 1, COALESCE(p_meta, '{}'::jsonb), NOW(), NOW());
    v_new_best := TRUE;
    v_existing := v_score;
  ELSIF v_score > v_existing THEN
    UPDATE playground_scores
      SET best_score = v_score,
          attempts   = attempts + 1,
          meta       = COALESCE(p_meta, '{}'::jsonb),
          last_at    = NOW()
      WHERE user_id = v_uid AND game_slug = p_game_slug;
    v_new_best := TRUE;
    v_existing := v_score;
  ELSE
    UPDATE playground_scores
      SET attempts = attempts + 1,
          last_at  = NOW()
      WHERE user_id = v_uid AND game_slug = p_game_slug;
  END IF;

  RETURN jsonb_build_object(
    'ok',       TRUE,
    'best',     v_existing,
    'new_best', v_new_best
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_playground_score(TEXT, INT, JSONB) TO authenticated;

-- =============================================================================
-- get_playground_leaderboard — top-N for a game
-- =============================================================================
-- Anonymous-readable. Returns ranked rows with user_id; the client joins
-- against the public users.display_name view to render usernames. We
-- intentionally don't expose emails here.

CREATE OR REPLACE FUNCTION get_playground_leaderboard(
  p_game_slug TEXT,
  p_limit     INT DEFAULT 10
)
RETURNS TABLE (
  rank       INT,
  user_id    UUID,
  best_score INT,
  last_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (ROW_NUMBER() OVER (ORDER BY best_score DESC, last_at ASC))::INT AS rank,
    user_id,
    best_score,
    last_at
  FROM playground_scores
  WHERE game_slug = p_game_slug
  ORDER BY best_score DESC, last_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
$$;

GRANT EXECUTE ON FUNCTION get_playground_leaderboard(TEXT, INT) TO anon, authenticated;

-- Sanity:
-- SELECT * FROM get_playground_leaderboard('worddrop', 5);
