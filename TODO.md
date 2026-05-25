# KoreHan TODO

This file is surfaced at the start of every Claude Code session by
`.claude/hooks/session-start.sh`. Keep it short and actionable — group
by status, prune merged/done items, and update as work lands.

When you (Claude) finish a task that's listed here, **edit this file
to remove or move the entry** in the same PR so the next session
doesn't keep reminding about closed work.

---

## In progress on `claude/new-session-KCAZ7`

- 1차 오딧 픽스: anon saved-words → DB migration on signup; goal/level-aware
  welcome banner; coach button no-flash; saved-word pending-save retry hook
- 2차 오딧 픽스 (P0+P1, 10 items):
  - #4 P0 — sign-out localStorage cleanup with prefs whitelist
  - #5 streak celebration key now per-user
  - #11 saved-word remove via dual `.eq()` (PostgREST .or() quote bug)
  - #1 coach button only disables after wallet RPC commits
  - #2 home news rail dispatches `khArticlesLoaded` on error paths
  - #3 cross-tab sync via `storage` event (saved words / XP / streak)
  - #6 auth modal a11y — Escape, focus trap, aria-modal, return focus
  - #7 speech-proxy fetch 30s AbortController timeout
  - #8 429 surfaces `code` + `detail` (monthly cap vs daily cap)
  - #9 MediaRecorder 2-min auto-stop cap (both speak paths)
- Cache busters bumped: saved-words / streak / articles / shared / study-room

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

- `supabase functions deploy admin-api` — **NOW URGENT** after PR #7BE.
  This deploy carries TWO fixes the admin tooling needs:
    (a) ALLOWED_TABLES gate now skipped when `method === 'rpc'`, so
        `🎲 Pick from pool` stops 400'ing with
        "Table not allowed: _rpc".
    (b) insert/upsert/update/delete now honour `params.returning` and
        `params.single` / `maybeSingle`, so `.insert().select('id')`
        actually inserts (the bug that made "batch from pool 1개" run
        a ghost "Auto-baking sentence analysis 1 / 74" against every
        existing conv).
  Pre-existing reason for this deploy still applies: ALLOWED_RPCS
  was earlier extended with `pick_conv_scenario` /
  `mark_conv_scenario_used`, and ALLOWED_TABLES with
  `conv_scenario_pool`.
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

## AI grammar audit — broader sweep (PR #7AD)

Beyond the top-5, all admin-side content-generation prompts now also
carry the 5-rule block via a shared `_srGrammarRulesBlock()` helper:

- **`korehan-x9f4k2m7.html`** (main admin CMS, 11 call sites):
  - `_srBuildPrompt` (daily-admin full content)
  - `study-room-grammar-admin` (regenerate grammar field)
  - `study-room-helpers-admin` (regenerate helpers)
  - `study-room-dictation-sentences-admin`
  - `study-room-dictation-questions-admin`
  - `study-room-topic-writing-admin`
  - `study-room-picture-admin`
  - `admin-pregen-pm` (Phrase Munch bundle pre-gen)
  - `admin-pregen-ke` (Key Expressions bundle pre-gen)
  - `phrase-bulk-pregen` (Sonnet, bulk phrase add)
  - `key-expressions-pregen` (live KE pre-gen)
- **`korehan-x9f4k2m7-phrases.html`** (phrase admin standalone,
  doesn't share JS scope — local helper copy):
  - `phrase-bulk-pregen` (bulk phrase generation)
  - `generate` (single-phrase polish)

Tally: top-5 (#7Z/#7AA/#7AB/#7AC) + server cron (#7Q) + admin sweep
(#7AD) = 16+ generation paths now have grammar guards. The "16 of 18
remaining" line item in the original audit is essentially closed.

Additional study-room.js paths covered in PR #7AF via a parallel
`_skrGrammarRulesBlock()` helper:
- `phrase-munch` (lesson example + practice generation)
- `speaking_feedback` (corrections[].corrected output)
- `dictation-gen` (Korean dictation sentences)
- `nuance-quiz-gen` (TOPIK 5-6 near-synonym quiz Korean)
- Plus added rule #5 (spacing) to the existing `study-room-daily`
  inline block (it only had rules 1-4 from #7Q).

Final study-room.js sweep landed in PR #7AG. Adds:
- `_skrGrammarRulesBlock()` (5 rules, all-Korean-output) used by
  `beginner-sentences`.
- New `_skrGrammarRulesScopedBlock()` (rules apply ONLY to
  correct/right/correction fields; intentionally-wrong fields are
  exempt) used by `topic-common-mistakes`, `grammar-curriculum`,
  `grammar-focus` × 2, `weak-grammar-drill`, `gf-judge-gen`,
  `article-study-admin`.

Skipped:
- `key-expr-situation-quiz`, `ke-situations-prefetch`,
  `ke-situations` — outputs are English situation descriptions, no
  Korean sentences generated.
- Translation features (`translate`, `translation`,
  `word-snap-translate`) — output is the translation itself.

## Deeper grammar categories (PR #7AH)

PR #7AH adds the high-leverage deeper rules per-feature:

- **Honorifics** (`-시-` / `께서`) landed in three high-volume paths:
  - Article body gen — for public figures (대통령 / 회장 / 의원 /
    교수 / 박사 / 사장 / 위원장 / 검사장 / 장관 / …) with explicit
    DO-NOT cases for inanimate subjects, 1st-person, and foreign
    figures named without a Korean title.
  - Story gen — for elevated characters (왕 / 왕비 / 황제 / 신령 /
    조부모 / 부모님 / 존경받는 어른) with explicit exemptions for
    antagonists, animal fable characters, and peer characters.
  - Conv gen — for formal scenarios (직원→손님 / 학생→선생님 /
    사원→상사 / 자녀→부모님) — higher-status interlocutor as subject
    triggers `-시-`.

- **Counters** (`마리` / `명` / `잔` / `권` / `병` / `개` / `대` /
  `장`) landed in:
  - Story gen — narrative descriptions of characters (명) and
    animals (마리), with explicit counter-class matrix.
  - Conv gen — shopping / restaurant / quantity scenarios where
    counter-class confusion is the most common learner error
    (사람 두 명 vs 사람 두 마리, 커피 한 잔 vs 한 개 etc.). Also
    notes that NATIVE numbers (한/두/세) pair with counters, not
    Sino-Korean numbers (일/이/삼).

- **Vowel harmony** (`아/어/여`): still NOT enforced anywhere.
  Model usually gets this from training. Add only if a specific
  error pattern surfaces from the data audit.

Server cron (`daily-content-gen`) still needs `supabase functions
deploy` to activate the server-side rules (#7Q + #7AB).

## Data audit (pending — needs user to run SQL in Supabase)

The 6 sample-dump queries from the chat. Once results are pasted in,
classify the actual error patterns living in the live DB and use that
to prioritize prompt patches across the 16 remaining paths. See
session transcript for the full SQL.

