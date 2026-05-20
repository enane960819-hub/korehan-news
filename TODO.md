# KoreHan TODO

This file is surfaced at the start of every Claude Code session by
`.claude/hooks/session-start.sh`. Keep it short and actionable — group
by status, prune merged/done items, and update as work lands.

When you (Claude) finish a task that's listed here, **edit this file
to remove or move the entry** in the same PR so the next session
doesn't keep reminding about closed work.

---

## Recently merged into main 2026-05-20

- #7P Study Room "Loading…" stuck — root-cause fix
- #7Q psych-verb 1st/3rd-person rule in daily-content prompt
- session-todo-reminder — this file's SessionStart hook
- #7R 🔴 My Room data-loss fix (starter-grant no longer wipes
  purchased items)
- #7S playground emoji → SVG icon sweep (9 files, 115 emojis +
  `js/core/icons.js` with 24 inline-SVG constants & `khSvg()` helper)
- #7T playground UI Korean → English (40 strings; learning content
  stays Korean)
- #7U Hangul Tetris jamo persistence — blocks no longer wipe between
  syllables; + floating "+N" popups, shake on wrong
- #7V Memory Match game-feel — running Score pill, +N popups, pairs
  progress bar
- #7W Dictation game-feel — streak system, score popup, input shake
- #7X Sentence Order game-feel — streak, popup, tray shake
- #7Y this PR — daily-content-gen Sonnet model id bumped to
  `claude-sonnet-4-6` (deprecated dated id removed)

## Edge Function deploys (must run locally — Cloudflare doesn't deploy these)

- `supabase functions deploy admin-api` — earlier PRs added
  `pick_conv_scenario` / `mark_conv_scenario_used` to ALLOWED_RPCS
  and `conv_scenario_pool` to ALLOWED_TABLES. Without this deploy,
  pool RPCs return 403 and admin conversation gen can't pick
  scenarios from the pool.
- `supabase functions deploy daily-content-gen` — to activate BOTH
  the psych-verb grammar rule (#7Q) AND the Sonnet model-id fix
  (#7Y) on the server cron.

## Stale data cleanup

- Today's `study_daily_content` rows are cached with the bad
  `~고 싶어요` (3rd-person subject) output. Clear them so the next
  load regenerates with the new prompt rule:
  ```sql
  DELETE FROM study_daily_content
  WHERE scheduled_date = CURRENT_DATE;
  ```

## AI Korean grammar — systematic audit

The psych-verb rule landed in only 2 of 18 AI generation paths.
Top 5 to harden, by output volume × current weakness:

- [x] **Path 1 — article body gen** (`korehan-x9f4k2m7.html`
  ~line 5236, Sonnet) — DONE in #7Z. 5-rule block injected:
  psych-verb 1st/3rd, subject-particle consistency, formality
  (평어체 for news body), tense agreement, spacing. Highest-volume
  Korean-output path; no enforcement before #7Z.
- [ ] **Path 2 — writing feedback `corrected_full`**
  (`korehan-study-room.js` ~line 9137). AI returns "corrected"
  Korean to the user; no second-pass validation. The 5-rule block
  from #7Z fits here directly — feedback should pass the same
  grammar bar as the article body it's modeled on.
- [ ] **Path 3 — picture description feedback**
  (`korehan-study-room.js` ~line 11769). Only a "coach" role string,
  no grammar rules. Same 5-rule block applies.
- [ ] **Path 4 — key-expressions** (server pre-gen
  `daily-content-gen` ~line 190 + client `korehan-study-room.js`
  ~line 3821) — multi-word constraint only. Add psych-verb
  + formality rules at minimum.
- [ ] **Path 5 — admin conv_gen / story_gen / topic-gen** in
  `korehan-x9f4k2m7.html` — full prompts not yet exposed in the
  code audit; need to read & patch each.

Also entirely uncovered grammar categories across all paths:
honorifics (`께서` / `-시-`), vowel harmony (`아/어/여`), spacing
rules (covered in #7Z body only), counters (`마리` / `명` / `잔` /
…). Add per-path only when relevant to the path's typical output.

Also entirely uncovered grammar categories across all paths:
honorifics (`께서` / `-시-`), vowel harmony (`아/어/여`), spacing
rules, counters (`마리` / `명` / `잔` / …).

## Data audit (pending — needs user to run SQL in Supabase)

The 6 sample-dump queries from the chat. Once results are pasted in,
classify the actual error patterns living in the live DB and use that
to prioritize prompt patches across the 16 remaining paths. See
session transcript for the full SQL.

