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
  ~line 5236, Sonnet) — DONE in #7Z. 5-rule block: psych-verb,
  subject-particle, formality (평어체 for news body), tense, spacing.
- [x] **Path 2 — writing feedback `corrected_full`**
  (`korehan-study-room.js` ~line 9082) — DONE in #7AA. Same 5 rules
  but formality MATCHES student's original register (해요체 in →
  해요체 out, never promote/demote inside corrected_full).
- [x] **Path 3 — picture description feedback**
  (`korehan-study-room.js` ~line 11813) — DONE in #7AA. Compact
  5-rule block; rules cover `corrected` rewrite + `sample` model
  answer.
- [x] **Path 4 — key-expressions** (server pre-gen
  `daily-content-gen` ~line 213 + client `korehan-study-room.js`
  ~line 3837) — DONE in #7AB. 5-rule block in BOTH paths. Cache
  versions bumped: `ke_v3_` → `ke_v4_` (localStorage), `kex3::` →
  `kex4::` (DB cache) — old cached entries may carry pre-rule bugs.
- [x] **Path 5 — admin conv_gen / story_gen** in
  `korehan-x9f4k2m7.html` — DONE in #7AC.
  - `conv_gen` (~line 8398): 5-rule block applied per-speaker
    (KakaoTalk dialogue switches speaker each message). Formality
    rule notes that two speakers MAY use different registers across
    the dialogue but each speaker stays internally consistent.
  - `story_gen` (~line 8884): 5-rule block applied to body narration.
    Formality rule says narration uses 평어체 (~한다 / ~했다 / ~다)
    and direct quotes carry the speaker's register. Stories are
    mostly 3rd-person — psych-verb rule fires often.
  - `topic-gen` (~line 4019): skipped — output is short noun-phrase
    labels (여행 계획, 식사 예절 etc.), not sentences. Rule block
    doesn't apply meaningfully.

## Top-5 AI grammar audit: COMPLETE

All 5 prioritized paths now carry the same 5-rule block (psych-verb
1st/3rd, subject-particle consistency, formality, tense agreement,
spacing) adapted per context. Server cron (`daily-content-gen`)
still needs `supabase functions deploy` to activate the server-side
rules (#7Q + #7AB).

Next: per-feature deeper rules — honorifics, vowel harmony, counters
— added only where the path's typical output makes them relevant.

Uncovered grammar categories across all paths (add per-feature
when the path's typical output makes them relevant): honorifics
(`께서` / `-시-`), vowel harmony (`아/어/여`), counters (`마리` /
`명` / `잔` / …). Spacing now covered in Paths 1-3.

## Data audit (pending — needs user to run SQL in Supabase)

The 6 sample-dump queries from the chat. Once results are pasted in,
classify the actual error patterns living in the live DB and use that
to prioritize prompt patches across the 16 remaining paths. See
session transcript for the full SQL.

