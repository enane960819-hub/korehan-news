# KoreHan TODO

This file is surfaced at the start of every Claude Code session by
`.claude/hooks/session-start.sh`. Keep it short and actionable — group
by status, prune merged/done items, and update as work lands.

When you (Claude) finish a task that's listed here, **edit this file
to remove or move the entry** in the same PR so the next session
doesn't keep reminding about closed work.

---

## Open PRs (need GitHub merge)

- **#7P** `claude/item7p-study-room-timeouts` — Study Room "Loading…"
  stuck. Root-cause fix: init now wraps synchronous renderers in
  `_safe()`, registers the 12s topic-fallback `setTimeout` as the
  very first statement of the IIFE, and the call site
  (`_khStudyRoomInitSafe`) catches both sync throws and async
  rejections so silent failures trigger `_applyFallbackTopic`. Cache
  buster bumped to `v=20260520a`.
- **#7Q** `claude/item7q-psych-verb-grammar-rule` — adds the Korean
  psych-verb 1st/3rd-person rule (`~고 싶다` vs `~고 싶어 하다`,
  `슬프다` vs `슬퍼하다`, …) to the daily-content prompt in BOTH the
  server cron (`daily-content-gen` Edge Function) and the client
  fallback (`_generateAndSaveDailyContent`). Fixes the
  "아이들은 만들고 싶어요" class bug. Cache buster `v=20260520b`.

## Edge Function deploys (must run locally — Cloudflare doesn't deploy these)

- `supabase functions deploy admin-api` — earlier PRs added
  `pick_conv_scenario` / `mark_conv_scenario_used` to ALLOWED_RPCS
  and `conv_scenario_pool` to ALLOWED_TABLES. Without this deploy,
  pool RPCs return 403 and admin conversation gen can't pick
  scenarios from the pool.
- `supabase functions deploy daily-content-gen` — after #7Q merges,
  to activate the psych-verb grammar rule on the server cron.

## Stale data cleanup

- Today's `study_daily_content` rows are cached with the bad
  `~고 싶어요` (3rd-person subject) output. Clear them so the next
  load regenerates with the new prompt rule:
  ```sql
  DELETE FROM study_daily_content
  WHERE scheduled_date = CURRENT_DATE;
  ```

## AI Korean grammar — systematic audit (16 remaining paths)

The psych-verb rule landed in only 2 of 18 AI generation paths. The
other 16 still have no Korean grammar guards. Top 5 to harden next
(ordered by output volume × current weakness):

1. **article body gen** — `korehan-x9f4k2m7.html` ~line 5252 (Sonnet,
   highest cumulative Korean output; has level-tone guidance but no
   enforcement).
2. **writing feedback `corrected_full`** — `korehan-study-room.js`
   ~line 9137 (AI returns "corrected" Korean to the user with no
   second-pass validation).
3. **picture description feedback** — `korehan-study-room.js`
   ~line 11769 (only a "coach" role string, no grammar rules).
4. **key-expressions** (server pre-gen `daily-content-gen` ~line 190
   + client `korehan-study-room.js` ~line 3821) — multi-word
   constraint only.
5. **admin conv_gen / story_gen / topic-gen** in
   `korehan-x9f4k2m7.html` — full prompts not yet exposed in the
   code audit; need to read & patch.

Also entirely uncovered grammar categories across all paths:
honorifics (`께서` / `-시-`), vowel harmony (`아/어/여`), spacing
rules, counters (`마리` / `명` / `잔` / …).

## Data audit (pending — needs user to run SQL in Supabase)

The 6 sample-dump queries from the chat. Once results are pasted in,
classify the actual error patterns living in the live DB and use that
to prioritize prompt patches across the 16 remaining paths. See
session transcript for the full SQL.

## Minor

- `supabase/functions/daily-content-gen/index.ts` line 80 still uses
  `claude-sonnet-4-20250514` (deprecated). Should be
  `claude-sonnet-4-6`.
