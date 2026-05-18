# Article Cache Backfill — Offline Pipeline

Generates `article_cache` rows (translation / vocab / grammar) for existing
articles that the admin's "재분석" button would have produced, but without
calling the Claude API. The deterministic parts (sentence splitting,
grammar pattern detection, `enforceDetectedPatterns`, vocab/grammar derive)
are loaded directly from the production source files, so the output
matches what the admin would write — same SQL row, same JSON shapes.

## Pipeline

```
data/articles.json          (you provide: id, title, body, level)
   │
   ▼  node 1-build-prompts.mjs
data/prompts/{id}.prompt.txt   (verbatim per-sentence prompt)
data/prompts/{id}.meta.json    (carries id/title/level/body forward)
   │
   ▼  (Claude generates JSON per prompt → save as data/responses/{id}.json)
data/responses/{id}.json    ({"sentences":[...]})
   │
   ▼  node 2-build-sql.mjs
data/backfill.sql           (INSERT ... ON CONFLICT statements)
```

Run `data/backfill.sql` in Supabase SQL editor → done.

## Step 0: Export articles from Supabase

In the SQL editor:

```sql
SELECT id, title, body, level
FROM articles
WHERE id NOT IN (SELECT article_id FROM article_cache WHERE article_cache.article_id IS NOT NULL)
ORDER BY date DESC NULLS LAST
LIMIT 20;
```

Download as JSON (or copy result, wrap as JSON array) → save to `data/articles.json`.

The column is `level` (not `topik_level`) based on the admin code reading
`a.level` everywhere. If your schema differs, adapt the SELECT and the
script will still work as long as the JSON keys are `id`, `title`, `body`,
`level`.

## Notes

- Only generates the three high-cost cache keys: `translation`, `vocab`,
  `grammar`. The admin's combined-Sonnet flow also writes `quiz` and
  `expressions`, but the dedicated "재분석" backfill flow
  (`backfillOneSentenceAnalysis` in `korehan-x9f4k2m7.html:6337`) writes
  the same three this script does.
- Schema: assumes the wide `article_cache` shape (one row per
  `article_id` with `translation` / `vocab` / `grammar` columns).
  Production code at multiple sites uses `.upsert({ article_id, ... },
  { onConflict: 'article_id' })`, so this is the dominant shape. KV-shaped
  schemas need a different INSERT format; rerun with that variant if
  needed.
- `enforceDetectedPatterns` runs the production gate against the AI's
  output so any patterns the model skipped are added back from the
  regex catalog. This means a slightly-off model response still
  produces a complete cache row.
