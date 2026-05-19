-- D2 audit + cache backfill cost estimate
-- Run in Supabase SQL editor, paste each block's result back to Claude.
-- Date: 2026-05-18

-- ============================================================================
-- BLOCK 1 — Content volume (drives total backfill cost)
-- ============================================================================

-- 1a. Articles by status + level
SELECT
  status,
  level,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE body IS NOT NULL AND length(body) > 200) AS with_body
FROM articles
GROUP BY status, level
ORDER BY status, level;

-- 1b. Stories by status + level (adjust column names if differ)
SELECT
  status,
  lvl,
  COUNT(*) AS n
FROM stories_data
GROUP BY status, lvl
ORDER BY status, lvl;

-- 1c. Conversations by status + level
SELECT
  status,
  level,
  COUNT(*) AS n
FROM conversations_data
GROUP BY status, level
ORDER BY status, level;

-- ============================================================================
-- BLOCK 2 — Cache coverage (what's already backfilled)
-- ============================================================================

-- 2a. article_cache coverage vs published articles
SELECT
  (SELECT COUNT(*) FROM articles WHERE status = 'published') AS total_published,
  (SELECT COUNT(*) FROM article_cache) AS cached_total,
  (SELECT COUNT(*) FROM articles a WHERE a.status = 'published'
     AND NOT EXISTS (SELECT 1 FROM article_cache c WHERE c.article_id = a.id)) AS missing_cache;

-- 2b. article_study_content coverage
SELECT
  (SELECT COUNT(*) FROM articles WHERE status = 'published') AS total_published,
  (SELECT COUNT(*) FROM article_study_content) AS study_total,
  (SELECT COUNT(*) FROM articles a WHERE a.status = 'published'
     AND NOT EXISTS (SELECT 1 FROM article_study_content c WHERE c.article_id = a.id)) AS missing_study;

-- 2c. Stories with stale/missing analysis (heuristic: < 5 vocab or grammar items)
SELECT
  COUNT(*) AS total_stories,
  COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(vocab, '[]'::jsonb)) < 5) AS sparse_vocab,
  COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(grammar, '[]'::jsonb)) < 5) AS sparse_grammar
FROM stories_data
WHERE status = 'published';

-- ============================================================================
-- BLOCK 3 — Tree-level audit sample (D1 fix only affects NEW articles)
-- ============================================================================

-- 3a. Random 3 published articles per level — paste body into Claude for review
SELECT
  id,
  level,
  section,
  title,
  created_at::date AS created,
  length(body) AS body_chars,
  -- Heuristic: count occurrences of TOPIK 3-4 markers in the body.
  -- Tree articles should have AT LEAST 4 occurrences total across these.
  (
    (length(body) - length(replace(body, '기 위해',   ''))) / length('기 위해')
    + (length(body) - length(replace(body, '게 되',     ''))) / length('게 되')
    + (length(body) - length(replace(body, '다고 하',  ''))) / length('다고 하')
    + (length(body) - length(replace(body, '으면서',   ''))) / length('으면서')
    + (length(body) - length(replace(body, '면서',     ''))) / length('면서')
    + (length(body) - length(replace(body, '것 같',    ''))) / length('것 같')
    + (length(body) - length(replace(body, '려고 하',  ''))) / length('려고 하')
    + (length(body) - length(replace(body, '기 때문',  ''))) / length('기 때문')
  ) AS tree_marker_hits
FROM articles
WHERE status = 'published'
  AND level = 'Intermediate'  -- = Tree
  AND body IS NOT NULL
ORDER BY random()
LIMIT 6;

-- 3b. Same for Advanced (Forest) — should have TOPIK 5-6 markers
SELECT
  id,
  level,
  section,
  title,
  length(body) AS body_chars,
  (
    (length(body) - length(replace(body, '기에 이르',  ''))) / length('기에 이르')
    + (length(body) - length(replace(body, '는 데 그',  ''))) / length('는 데 그')
    + (length(body) - length(replace(body, '기 마련',   ''))) / length('기 마련')
    + (length(body) - length(replace(body, '로 인하',   ''))) / length('로 인하')
    + (length(body) - length(replace(body, '게 하',     ''))) / length('게 하')
    + (length(body) - length(replace(body, '시키',      ''))) / length('시키')
    + (length(body) - length(replace(body, '아지',      ''))) / length('아지')
    + (length(body) - length(replace(body, '어지',      ''))) / length('어지')
    + (length(body) - length(replace(body, '기는커녕',  ''))) / length('기는커녕')
  ) AS forest_marker_hits
FROM articles
WHERE status = 'published'
  AND level = 'Advanced'  -- = Forest
  AND body IS NOT NULL
ORDER BY random()
LIMIT 3;

-- 3c. Sprout sample (TOPIK 1-2 — should NOT have advanced markers)
SELECT
  id,
  level,
  section,
  title,
  length(body) AS body_chars
FROM articles
WHERE status = 'published'
  AND level = 'Beginner'  -- = Sprout
  AND body IS NOT NULL
ORDER BY random()
LIMIT 3;

-- 3d. Seed sample (TOPIK 0 — entry level)
SELECT
  id,
  level,
  section,
  title,
  length(body) AS body_chars
FROM articles
WHERE status = 'published'
  AND level = 'Starter'  -- = Seed
  AND body IS NOT NULL
ORDER BY random()
LIMIT 3;

-- ============================================================================
-- BLOCK 4 — Story grammar duplicate detection (D1 prompt fix only affects NEW)
-- ============================================================================

-- 4a. Story rows whose grammar[] has potential duplicates by pattern title
--     (heuristic: two entries whose pattern strings share a 4+ char substring)
--     Manual review of flagged rows in D2.
SELECT
  id,
  title,
  jsonb_array_length(grammar) AS grammar_count,
  grammar
FROM stories_data
WHERE status = 'published'
  AND jsonb_array_length(COALESCE(grammar, '[]'::jsonb)) >= 8
LIMIT 5;

-- ============================================================================
-- BLOCK 5 — Cost estimate (paste totals from above to Claude)
-- ============================================================================

-- Run all of BLOCK 1 + 2 above, paste results.
-- Claude calculates:
--   missing_cache × $0.0055   (Haiku for analysis)
--   missing_study × $0.0055   (Haiku for study content)
--   sparse stories × $0.027   (Sonnet for full re-gen with body)
--   flagged Tree articles × $0.027   (Sonnet re-gen with new prompt)
-- Total = backfill budget needed.
