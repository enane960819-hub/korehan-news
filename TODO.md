# KoreHan TODO

This file is surfaced at the start of every Claude Code session by
`.claude/hooks/session-start.sh`. Keep it short and actionable — group
by status, prune merged/done items, and update as work lands.

When you (Claude) finish a task that's listed here, **edit this file
to remove or move the entry** in the same PR so the next session
doesn't keep reminding about closed work.

---

## In progress on `claude/new-session-KCAZ7`

- 3차 오딧 P0+P1 (4 commits on `claude/new-session-KCAZ7`):
  - **Edge Functions** — tts-proxy auth (F1), claude-proxy input-size
    cap + feature str cap + failed-call counter (F3/F10/F11),
    notify-signup Discord injection sanitizer (F4), daily-content-gen
    weak CRON_SECRET reject + app_settings mutex (F5/F6), admin-api
    REST path traversal + mutation-filter required + hardcoded anon
    key removal (F7/F8/F14), speaking-pass-checkout origin-bound CORS
    (F12), proxy CORS now omits ACAO for unknown origins across 7
    proxies (F9).
  - **Admin CMS** — admin gate (korehan-admin-gate.js) on 4 aux pages
    (AD-F1); double-click guards on regenAllStoriesAI / saveAllConvs /
    saveAllStories / gcAdminPregenAll (AD-F2/F3); abort button +
    cost-aware confirm on gcAdminPregenAll + retryFailedCaches
    (AD-F4/F8); _ccastEditRole/Cast prompt Cancel null fix (AD-F6);
    saveTopic hidden Claude alert + skip-pregen on no-change (AD-F9);
    _aiCacheInFlight `|| 0` normalisation (AD-F15); client_errors
    delete routed through admin-api (AD-F14).
  - **Mobile UX** — auth + comment inputs font-size 14 → 16 (MO-1);
    bottom-nav safe-area-inset (MO-2); article action 28 → 40 (MO-3);
    auth modal close 30 → 44 (MO-4); hover-tooltip / sentence-hint /
    sentence-panel / comment-drawer close all ≥ 32 (MO-5/7/13); iOS
    100vh → 100vh + 100dvh on 9 pages (MO-10).
  - **Performance** — kh-universe.js (~117KB) lazy-loaded on click
    (was eager on study-room + learning-overview, PF-P0-4); article
    thumbnails get loading="lazy" + width/height (PF-P1-7); hero
    carousel pauses on tab hidden, no-op for empty slides (PF-P1-10);
    1-second clock tick stops on tab hidden (3,600 wake-ups/hour on
    background tabs eliminated, PF-P1-9); session refresh skips
    anonymous sessions (PF-P3-19); Word-Drop background video
    respects prefers-reduced-motion (PF-P1-8).
  - **Edge Functions deployed 2026-05-25** ✅: all 8 functions
    (claude-proxy, admin-api, daily-content-gen, notify-signup,
    tts-proxy, image-search, speech-proxy, speaking-pass-checkout)
    pushed to prod via supabase CLI. Verified each returns 401
    without auth (tts-proxy now correctly rejects unauthed callers).
  - **Audit F2 closed 2026-05-25** ✅: RLS enabled on
    `user_quota_overrides` with a `service_only` policy
    (`FOR ALL TO authenticated USING (false) WITH CHECK (false)`).
    Verified anon writes return `42501: new row violates row-level
    security policy`. service_role bypasses RLS by design so
    claude-proxy's per-user quota override lookup keeps working.
  - **3차 오딧 P2 batch (this commit)**:
    - **AD-F10** Article body prompt caching: claude-proxy now
      forwards `cache_control` blocks + sends the prompt-caching
      beta header when any message block carries cache_control. Admin
      autoGenArticle body call restructured so the static
      `_khLabels + _khBodyCatalog` prefix (~12K input tokens) is the
      cached block, with the per-article `bodyPrompt + _khSoftSuggest`
      as the dynamic suffix. Usage logger folds cache_creation /
      cache_read tokens into `input_tokens` at their pricing weights
      so the monthly-USD calc stays accurate without DB schema
      changes. Expected ~$70/mo saved at 100 articles/day.
    - **AD-F11** Sonnet → Haiku swaps (2 safe sites, conservative
      pass): conv_analyze + vocab-sanity-check both moved to
      Haiku 4.5 (~7× cheaper, schema-following shape proven by
      neighbouring admin paths already on Haiku).
    - **AD-F13** srForceRegenerateScheduled + srRegenerate now use a
      new _srSafeRegenerate helper that snapshots the row → deletes →
      generates → restores the snapshot on any failure path. Previous
      DELETE-before-generate left learners with no content for that
      (date, level) on any Claude / network failure.
  - **Out of scope / deferred** (lower-priority items from the same
    audits): defer/lazy-split of korehan-shared.js + study-room.js,
    @import → link migration in shared.css (40+ HTMLs touched, risk
    high without verify), Sonnet → Haiku audit on remaining ~10 call
    sites (need quality verify), CSS critical-path extraction, SW
    font caching, deeper grammar audit (#7AI).

- 4차 오딧 P0+P1 (4 commits on `claude/new-session-KCAZ7`):
  - **Speaking vertical** (af21da5) — coin-stuck recovery on upload/
    insert fail (F1), tts-proxy drop service-role-key anon fallback
    (F2), pcDemoPlay clear-before-reassign (F3), TUTOR_EMAILS single
    source of truth via window.KH_TUTOR_EMAILS (F4 partial), filler
    regex actually matches Korean now (F13 — was permanently 0),
    _speakRecorder/_speakBlob/_speakChunks null on stop+submit
    (F9/F10), SpeechRecognition abort on error (F8), MediaRecorder
    feature-check before getUserMedia for in-app browsers (F7),
    bilingual + UA-branched mic permission errors (F6), TTS LRU
    auto-clear on pagehide + SIGNED_OUT (F12), BroadcastChannel
    cross-tab wallet sync (F11), word-chip XSS proper escape (F17).
  - **Onboarding funnel** (612b309) — broken
    korehan-section-news.html link fixed (404 on every business-goal
    user's first action), index.html#sprout dead anchor re-targeted
    to korehan-study-room.html in 3 places, pricing aligned (landing
    ₩9,900 → $8.99 matching courses canonical Standard/Pro tiers),
    onboarding state persists to localStorage on every step (was
    only on goStep4 → OAuth), Step 4 gets secondary "Sign up with
    email" button, refund-policy email han@→hello@, og:image →
    real hero JPG (was 404 og-default.png on 4 pages), legal anchor
    href +.html, placement test "~3 min" estimate.
  - **Performance** (1735e1f) — 11 landing images get
    loading="lazy" + width/height (3.2MB deferred off cold path),
    hero JPG gets fetchpriority="high", 9 beginner-guide images
    same treatment, _headers: HTML now public/max-age=0/
    s-maxage=60/SWR=86400 so Cloudflare edge-caches HTML (TTFB
    150ms → ~15ms on warm CF).
  - **A11y** (this commit) — global :focus-visible 2px outline
    rule (was missing entirely), global prefers-reduced-motion
    guard for all transitions/animations, .art-sent Enter/Space
    keyboard activation (sentence analysis was keyboard-locked),
    contrast swap #94a3b8 → #64748b on 3 critical light-bg uses
    (article-meta-time, notif-empty, notif-item-time), kh-wb-save-
    icon #cbd5e1 → #64748b (was 1.61:1), skip-to-content link
    injected on every page with auto-tagged #main-content target,
    notif bell + user avatar + hamburger get aria-haspopup +
    aria-expanded that toggle on open/close, toast() mirrors text
    into a global aria-live region for SR users.

  - **4차 deploys** ✅: tts-proxy redeployed (F2).
  - **4차 verify still needed**: tutor_students / tutor_lessons
    RLS check in Supabase SQL editor:
    `SELECT polname, polcmd FROM pg_policy
     WHERE polrelid IN ('public.tutor_students'::regclass,
                        'public.tutor_lessons'::regclass);`
    If missing per-tutor isolation policies, add them.

  - **4th audit followups (this round, closed)**:
    - PNG → WebP for 17 landing/beginner-guide images (~5.1 MB →
      ~1.2 MB wire, 77% cut). <picture> + WebP source + PNG fallback
      pattern; image-set() for CSS background uses. Combined with
      lazy-loading: home cold-cache ~4.2 MB → ~1 MB.
    - Comment drawer focus trap + Escape + return-focus (A11y #8).
    - Study-room 9 master-card divs gained role=button + tabindex=0;
      generic shared.js delegate fires .click() on Enter/Space for
      any role=button + onclick element so keyboard users can launch
      learning modes + word-bank rows (A11y #10/#19).
    - Webhook idempotency logging — duplicate Stripe retries now
      surface as WARN + idempotent:true in response (F5 partial;
      RPC contract alignment still TODO).
    - admin_retrigger_feedback Sonnet → Haiku 4.5 (3rd safe swap,
      same shape as the daily article-analysis path on Haiku).
  - **Still deferred** (sandbox-blocking or large refactor):
    - Onboarding pricing reflow (Pro+Standard side-by-side card)
    - Google Fonts payload reduction (decide weights first)
    - aria-label on icon-only role=button cards in study-room
      (openDailyReview / openWeeklyReview / openMonthlyReview,
      openFastTrack / openSlangModal / openPhoneModal, etc.) —
      keyboard-focusable now, but screen-reader users hear only
      "button" without context.
    - grant_speaking_coins SQL contract: return
      `{ ok, reason, granted_coins, balance }` so the new webhook
      idempotency logging actually distinguishes duplicates from
      first-time grants. Owner to align in the migration.
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
- 2차 오딧 P2 (3 items):
  - #10 Word-Drop background video pauses on visibilitychange
  - #12 Feedback poller pauses on hidden, clears on pagehide
  - Bonus: TTS playTTSAudio revokes prior non-cached blob: URLs
- Cache busters bumped: saved-words / streak / articles / shared / study-room

## Recently merged into main 2026-05-26

- **#605 HOTFIX 3: minified-bundle isolation v2** — re-introduces
  IIFE wrap (fixes esbuild keepNames helper collision that caused
  home/study-room infinite loading) with a getter/setter footer so
  `var supaUser` mutations propagate cross-file (was the v1
  regression where study-room said "please log in" while logged in).
- **A11y #11**: lang attribute consistency sweep —
  korehan-study-room.html, refund-policy.html (`ko-KR` → `en`,
  English UI), onboarding-preview-compact.html (`ko` → `en`,
  English content). Korean-content pages (cards, reporter,
  reporters) kept at `lang="ko"`.
- **#606 A11y + Picture-Call polish**:
  - 46 clickable `<div>`s in study-room.html got
    `role="button" tabindex="0"` so keyboard users can Tab to /
    Enter-activate notification banners, mode cards, flashcard
    rows, jamo tiles, etc. Existing global Enter/Space handler in
    shared.js already wired up the activation; the divs just
    weren't marked.
  - Picture-Call modal (F18-F20):
    `pcDemoPlay(startAt)` accepts a seek target so demo-mode
    seeking no longer snaps back to 0; `pcTogglePlay` catches the
    `_pcAudio.play()` Promise rejection (autoplay / tab-suspension)
    so the button doesn't lock in "pause" mode forever;
    `closePhoneModal` resets `_pcCurrentCall` + `_pcDemoTime` so a
    re-open starts on the call list.

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

## Edge Function deploys

All 8 Edge Functions deployed to prod 2026-05-25 (claude-proxy,
admin-api, daily-content-gen, notify-signup, tts-proxy, image-search,
speech-proxy, speaking-pass-checkout). This includes the PR #7BE
admin-api fixes (RPC gate / returning / single) and the
daily-content-gen psych-verb + Sonnet model-id changes that had
been waiting on a deploy.

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

