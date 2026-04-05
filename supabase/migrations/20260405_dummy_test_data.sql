-- ═══════════════════════════════════════════════════════════════
-- Learning Hub — Dummy Test Data
-- Replace 'TEST_USER_ID' with an actual user UUID before running
-- ═══════════════════════════════════════════════════════════════

-- ★ STEP 1: Set your test user ID here
-- Find it in Supabase Auth > Users, or run: SELECT id FROM auth.users LIMIT 1;
-- Then replace every occurrence of TEST_USER_ID below

-- ── 30 days of activity_log (reads, quizzes, word saves, writing) ──
DO $$
DECLARE
  uid uuid := 'TEST_USER_ID';  -- ← CHANGE THIS
  d date;
  i int;
  types text[] := ARRAY['read','read','read','quiz','word_save','word_save','writing_submit','grammar_practice','dictation','picture_desc'];
  ctypes text[] := ARRAY['article','conversation','story','daily_review','vocab','vocab','daily_topic','daily_topic','daily_topic','daily_topic'];
BEGIN
  FOR day_offset IN 0..29 LOOP
    d := CURRENT_DATE - day_offset;
    -- Skip some days randomly (20% chance of no activity)
    IF random() < 0.2 THEN CONTINUE; END IF;
    -- 3-8 activities per day
    FOR i IN 1..floor(random()*6+3)::int LOOP
      INSERT INTO user_activity_log (user_id, activity_type, content_type, content_id, content_title, score, max_score, study_date, created_at, metadata)
      VALUES (
        uid,
        types[floor(random()*10+1)::int],
        ctypes[floor(random()*10+1)::int],
        'test-' || floor(random()*100)::int,
        CASE floor(random()*5)::int
          WHEN 0 THEN '한국 음식 문화'
          WHEN 1 THEN '서울 지하철 에티켓'
          WHEN 2 THEN '한국의 계절 행사'
          WHEN 3 THEN '직장에서 일하기'
          ELSE '오늘 하루 어땠나요?'
        END,
        CASE WHEN random() < 0.4 THEN floor(random()*100)::int ELSE NULL END,
        CASE WHEN random() < 0.4 THEN 100 ELSE NULL END,
        d,
        d + (interval '1 hour' * floor(random()*14+8)::int),
        '{}'::jsonb
      );
    END LOOP;
  END LOOP;
END $$;

-- ── 20 quiz results with wrong patterns ──
DO $$
DECLARE
  uid uuid := 'TEST_USER_ID';  -- ← CHANGE THIS
  d date;
  qtypes text[] := ARRAY['daily_review','grammar','writing_feedback','vocab','dictation'];
  score int;
  acc int;
BEGIN
  FOR day_offset IN 0..19 LOOP
    d := CURRENT_DATE - day_offset;
    IF random() < 0.3 THEN CONTINUE; END IF;
    score := floor(random()*15+5)::int;
    acc := floor(random()*40+60)::int;
    INSERT INTO user_quiz_results (user_id, quiz_type, score, max_score, accuracy_pct, wrong_patterns, study_date, created_at, details)
    VALUES (
      uid,
      qtypes[floor(random()*5+1)::int],
      score, 20, acc,
      jsonb_build_object(
        'PARTICLE', floor(random()*4)::int,
        'TENSE', floor(random()*3)::int,
        'WORD_ORDER', floor(random()*2)::int,
        'SPELLING', floor(random()*2)::int,
        'VOCAB', floor(random()*3)::int
      ),
      d,
      d + (interval '1 hour' * floor(random()*14+8)::int),
      '{}'::jsonb
    );
  END LOOP;
END $$;

-- ── Weekly snapshots (past 4 weeks for comparison) ──
DO $$
DECLARE
  uid uuid := 'TEST_USER_ID';  -- ← CHANGE THIS
  ws date;
  we date;
BEGIN
  FOR w IN 0..3 LOOP
    ws := date_trunc('week', CURRENT_DATE)::date - (w * 7);
    we := ws + 6;
    INSERT INTO user_weekly_snapshot (user_id, week_start, week_end, xp_earned, articles_read, words_learned, quizzes_done, avg_quiz_accuracy, writing_count, writing_avg_score, skill_reading, skill_vocab, skill_grammar, skill_writing, skill_listening, wrong_patterns, active_days)
    VALUES (
      uid, ws, we,
      floor(random()*300+100)::int,                    -- xp
      floor(random()*8+2)::int,                        -- articles
      floor(random()*20+5)::int,                       -- words
      floor(random()*10+3)::int,                       -- quizzes
      floor(random()*25+65)::int,                      -- accuracy
      floor(random()*4+1)::int,                        -- writing
      floor(random()*30+60)::int,                      -- writing score
      LEAST(100, 30 + w*8 + floor(random()*15)::int),  -- reading (grows over time)
      LEAST(100, 25 + w*10 + floor(random()*10)::int), -- vocab
      LEAST(100, 20 + w*12 + floor(random()*10)::int), -- grammar
      LEAST(100, 10 + w*5 + floor(random()*10)::int),  -- writing
      LEAST(100, 5 + w*3 + floor(random()*5)::int),    -- listening
      jsonb_build_object('PARTICLE', floor(random()*10+5)::int, 'TENSE', floor(random()*8+3)::int, 'WORD_ORDER', floor(random()*5+2)::int, 'SPELLING', floor(random()*4+1)::int, 'VOCAB', floor(random()*6+2)::int),
      floor(random()*3+4)::int                         -- active days
    )
    ON CONFLICT (user_id, week_start) DO NOTHING;
  END LOOP;
END $$;

-- ── Weekly goal for current week ──
INSERT INTO user_weekly_goals (user_id, week_start, goal_articles, goal_words, goal_quizzes, goal_writing, goal_active_days)
VALUES ('TEST_USER_ID', date_trunc('week', CURRENT_DATE)::date, 5, 20, 10, 3, 5)
ON CONFLICT (user_id, week_start) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DONE! After running, check:
-- SELECT count(*) FROM user_activity_log;
-- SELECT count(*) FROM user_quiz_results;
-- SELECT * FROM user_weekly_snapshot ORDER BY week_start DESC;
-- ═══════════════════════════════════════════════════════════════
