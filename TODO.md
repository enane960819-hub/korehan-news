# KoreHan TODO

This file is surfaced at the start of every Claude Code session by
`.claude/hooks/session-start.sh`. Keep it short and actionable — group
by status, prune merged/done items, and update as work lands.

When you (Claude) finish a task that's listed here, **edit this file
to remove or move the entry** in the same PR so the next session
doesn't keep reminding about closed work.

---

## In progress on `claude/audit-19-errors`

- **19차 error handling + observability (2026-05-27)** — 18 findings.
  This PR ships 7 high-impact fixes (1 P0 + 6 P1). The rest of the
  silent-failure surface (`.then() no .catch`, polling-loop logs,
  JSON.parse context, submit-button no-timeout) deferred for
  careful work.
  - **F8 (P0) — LANDED**: `daily-content-gen` lock-leak on the
    outer catch path. Before: an Anthropic 429 / timeout / DB
    hiccup inside the main work would skip the happy-path lock
    cleanup and exit the catch without releasing. Next pg_cron
    pass within 15 min saw "another generation already in
    progress" and silently skipped → stale daily content until
    someone noticed. Fixed by hoisting `lockHeld` + `LOCK_KEY`
    + `sbForCleanup` to function scope so the catch block can
    release.
  - **F9 (P1) — LANDED**: same Edge Function — outer catch now
    persists to `client_errors` with `severity='critical'`, which
    fires the Discord webhook via `notify-critical-error`.
    Previously the cron silently 500'd with no operator trace.
  - **F1 (P1) — LANDED**: `loadAllTopics()` in
    `korehan-study-room.js` — added `res.ok` check before
    `res.json()` so a 401/403/500 from Supabase doesn't try to
    JSON-parse an error page. Also logs the underlying error to
    `kh_log_error` instead of silently falling back to dummy
    topics.
  - **F2 (P1) — LANDED**: `study_grammar_progress` upsert in
    `korehan-study-room.js` now checks `.error` and logs. Cross-
    device grammar-progress sync no longer silently breaks.
  - **F3 (P1) — LANDED**: `daily_reviews` upsert in
    `korehan-learning-overview.html` checks `.error` and logs.
    Daily-review analytics no longer silently corrupted.
  - **F4 (P1) — LANDED**: reporter gift coin-deduct in
    `korehan-reporter.html` — was firing the `coin_transactions`
    insert even when the `user_stats` balance update failed,
    causing ledger-vs-balance drift. Now aborts with
    `BALANCE_UPDATE_FAILED` + critical alarm.
  - **F6 (P1) — LANDED**: `user_stats` XP/streak write in
    `korehan-learning-overview.html` checks `.error` on both the
    update and insert branches. XP loss no longer silent.

  **STILL OPEN from 19차**:
  - **F5 (P2)**: feedback poll-loop swallows errors silently —
    no operator visibility when polling fails for 10 min.
  - **F7 (P2)**: reporter gift_history insert only handles
    "missing table" error, swallows all others.
  - **F10 (P2)**: `grammar_examples_cache` upsert in
    daily-content-gen — already in a try/catch but errors not
    logged (acceptable best-effort, low priority).
  - **F11 (P2)**: `.then(function(){})` chains lacking `.catch()`
    in study-room.js — audit's line ref was wrong; needs re-scan
    to find real instances.
  - **F13 (P2)**: empty `catch(e) {}` on XP/streak save needs
    user-visible feedback.
  - **F14 (P2)**: submit-all button has no network timeout —
    stays disabled forever on hung request.
  - **F17 (P2)**: `JSON.parse(clean)` in `korehan-learn.html`
    catches but loses context for debugging.
  - **F18 (P2)**: `korehan-hover-tooltips.js` loader hygiene —
    not yet inspected.

  **AUDIT MISCLASSIFICATIONS** (skipped):
  - F12: duplicate of F1, same finding.
  - F15: audit said "actually LOW because the RPC has the
    constraint" — no action needed.
  - F16: audit said "this is correct" — no action needed.

---

## On `claude/audit-18-mobile` (PR #633 merged 2026-05-27)

- **18차 mobile + responsive UX (2026-05-27)** — 18 findings. This
  PR ships 6 safe-and-targeted fixes; device-test-heavy items
  (iOS Safari sticky / 100vh sweep / keyboard-covers-input)
  deferred.
  - **F1 — LANDED**: Removed `maximum-scale=1, user-scalable=no`
    from `korehan-fun-dictation.html` and
    `korehan-fun-sentence-order.html`. Pinch-zoom is now allowed
    on both games — WCAG 2.1 Resize Text (1.4.4) compliance.
  - **F2 — LANDED**: `.pc-back-btn` in `korehan-study-room.css`
    bumped from 32×32 to 44×44 (icon size 14→16). Now meets the
    iOS/Android OS-recommended 44px touch-target minimum.
  - **F3 — LANDED**: Top-nav dropdown (`.has-drop`) now reveals
    via `:focus-within` in addition to `:hover`. Keyboard users
    and (eventually-Tab-able) mobile users can now access submenus
    that were previously hover-only.
  - **F6 — LANDED**: 4 Korean-text inputs in study-room.html
    (`.wb-search`, `#wb-search`, `#dr-typed`, `#rv-typed-input`)
    now have `lang="ko" autocomplete="off" spellcheck="false"` —
    triggers the correct hangul IME on iOS/Android without
    spell-check underlines.
  - **F8 — LANDED**: Admin CMS `.mbox` mobile rule changed from
    `100vw/100vh` to `100%/100dvh`. Eliminates horizontal-scroll
    bug on phones (where `100vw` can include the scrollbar) and
    fixes iOS Safari bottom-toolbar trap via `100dvh`.
  - **F14 — LANDED**: Mobile notification bell bumped from 34×34
    to 44×44 (icon 16→18). Notification action buttons
    (`.kh-notif-item-btn`) bumped from `padding 5px 12px / font
    11px` to `padding 8px 14px / min-height 36px / font 12px`
    desktop, `padding 10px 16px / min-height 44px / font 13px`
    on mobile.

  **STILL OPEN from 18차**:
  - **F4 (P1)**: `.dp-vi-del / .dp-gi-del` delete buttons on
    vocab/grammar items — padding 2px 6px / font 11px. Bump
    needed but careful — adjacent layout dense.
  - **F5 (P2)**: `.detail-close` (34×34) — already swapped to
    floating 44×44 via media query, so likely no fix needed; the
    audit didn't catch the existing swap.
  - **F7 (P2)**: Inputs covered by on-screen keyboard. Needs JS
    `scrollIntoView` on focus + iOS device test.
  - **F10 (P2)**: `100vh` sweep — need to find all remaining
    bare-100vh uses and add `100dvh` fallback (1 confirmed in
    `learning-overview.html:3943`, more likely).
  - **F11 (P2)**: `position: sticky` inside
    `-webkit-overflow-scrolling: touch` containers — needs real
    iOS Safari testing.
  - **F12 (P2)**: `overscroll-behavior-y: contain` on game pages
    — needs gameplay testing to confirm it's actually disruptive.
  - **F13 (P2)**: `.dp-pr-step` tabs (icon 13px / padding 6px
    10px) — touch-target bump; same density concern as F4.
  - **F18 (P2)**: Tiny 11–12px labels/badges on mobile —
    enhancement.

  **AUDIT MISCLASSIFICATIONS** (no action):
  - F9, F15, F16, F17: audit itself said "already compliant ✓"
    or "already addressed". No new work needed.

---

## On `claude/audit-17-deadcode` (PR #632 merged 2026-05-27)

- **17차 dead-code + arch consolidation (2026-05-27)** — 12 findings.
  This PR ships 4 low-risk cleanup items; Speaking Coach v3
  deletion + unused-RPC sweep deferred for owner schema confirmation.
  - **F2 — LANDED**: `escapeHTML` duplicate in `korehan-study-room.js`
    deleted (the shared 5-char version in `js/core/security.js`
    loads first and is strictly safer than the 3-char local copy).
    BONUS: `korehan-grammar-tooltips.js` deleted entirely — zero
    references anywhere in the repo, fully dead file.
  - **F3 — LANDED**: 4 truly-orphan images deleted
    (`feat-sprout.{png,webp}`, `feat-review.{png,webp}` in
    `korehan/img/guide/`). Audit also flagged 4 others but those
    turned out to be referenced from `kh-universe.js` / `phrases.js`
    — kept.
  - **F4 — LANDED**: 8 stale cache-busters bumped to `v=20260527f`
    on `korehan-study-room.html`, `korehan-learning-overview.html`,
    `korehan-mypage.html`, `korehan-x9f4k2m7.html`. All 8 underlying
    scripts (`kh-canvas-engine.js`, `kh-flashcards.js`,
    `kh-listening.js`, `kh-grammar-tree.js`, `kh-sentence-builder.js`,
    `kh-curriculum.js`, `kh-badges.js`, `kh-vocab-prompt.js`) were
    actually modified in PR #589 — classic PR #526 stale-buster bug.
  - **F6 — LANDED**: 6 unconditional debug `console.log` calls
    removed: `[auth] implicit hash`, `[sent-bg] cached`,
    `[conv-sent-bg] cached`, `[xp] xp_log cols`, `[xp] logged`,
    `[save_daily_content] RPC ok`. All `console.warn` error
    handlers preserved.

  **STILL OPEN from 17차 (owner sign-off needed)**:
  - **F1 (P1)**: Speaking Coach v3 dead surface — delete
    `20260422_speaking_coach_wallet.sql` + dependent
    `20260526_audit_8_refund_handler.sql` + `speaking-pass-checkout`
    Edge Function. Owner confirmed v3 unused ("미사용임"); deletion
    is straightforward but irreversible.
  - **F5 (P2)**: 12 unused RPCs (`are_friends`, `is_blocked`,
    `is_tutor_user`, `purchase_streak_freeze`, etc.). Needs
    per-RPC audit to confirm none are called by admin tools
    or cron.
  - **F8 (P2)**: unfinished admin filter at
    `korehan-x9f4k2m7.html:6584` ("TODO: not yet wired"). Needs
    owner intent — finish or remove.
  - **F9 (P2)**: `speaking-pass-webhook` Edge Function references
    v3 schema. Coordinate with F1 — confirm Stripe webhook config
    before deletion.
  - **F12 (P1)**: Migration version mismatch — code references v3
    RPCs but prod is on v2. Document or fix; depends on F1.

  **AUDIT MISCLASSIFICATIONS** (skipped):
  - F7 (newsletter RPC comment): comment was actually correct —
    audit misread it. No action.
  - F10/F11: stable code / future-refactor — no action this round.

---

## On `claude/audit-16-dr` (PR #631 merged 2026-05-27)

- **16차 DR / Backup / Runbook (2026-05-27)** — 15 findings. This
  PR ships the documentation half of the audit (runbooks +
  inventory + env template) plus the standalone PERF-F15 DB-size
  visibility migration that piggybacked on this branch.
  - **PERF-F15 — LANDED**: admin `kh_db_size_overview()` RPC
    + DB-size panel in the Cost Monitor tab. Owner can see
    total DB size, top 20 tables, top 10 indexes.
  - **DR-F1 — LANDED**: `docs/runbook-backup-restore.md`. Manual
    `pg_dump` weekly snapshot procedure + quarterly restore drill
    + PITR notes.
  - **DR-F2 — LANDED**: `docs/runbook-incident-response.md`.
    Step-by-step triage tree (alarm check → 4 dashboards →
    smoke-detectors → rollback procedures → comms → post-mortem).
  - **DR-F4 — LANDED**: `docs/runbook-storage-backup.md`. Manual
    `rclone` weekly bucket copy + future GitHub Actions cron
    template.
  - **DR-F5 — LANDED**: `docs/secrets-inventory.md`. Where every
    secret lives + monthly verification queries.
  - **DR-F10 — LANDED**: `docs/runbook-data-recovery.md`. Three
    named scenarios (single-user regret / bulk-loss / logical
    corruption) with concrete pg_dump / PITR recipes.
  - **DR-F11 — LANDED**: `docs/runbook-key-rotation.md`. Per-key
    rotation procedure + yearly checklist + compromise response.
  - **DR-F12 — LANDED**: `.env.example` + README first-time-setup
    section. New contributor can clone → set up local dev in
    minutes.

  **STILL OPEN from 16차**:
  - **DR-F3 (P1)**: Automated weekly pg_dump → off-site. Blocked
    on owner picking a destination (R2 vs B2) + setting up the
    GitHub Action with stored credentials.
  - **DR-F6 (P1)**: Discord webhook URL not yet in
    `app_settings.error_notify_webhook`. Owner action: paste it.
  - **DR-F7 (P2)**: status.korehani.com — no infra; future work.
  - **DR-F8 (P2)**: Auto-postmortem template not enforced via CI.
  - **DR-F9 (P2)**: Audit-log table for admin SQL actions.
  - **DR-F13 (P2)**: Migration dry-run convention not codified
    (CONTRIBUTING.md missing).
  - **DR-F14 (P2)**: BEFORE DELETE row-count guard on big tables.
  - **DR-F15 (P2)**: Disaster recovery time objective (RTO/RPO)
    not formally written down — implicit in runbooks.

  **OWNER ACTIONS for 16차**:
  - Confirm Supabase tier (Free vs Pro); upgrade if PITR matters.
  - Apply migration `20260527_audit_13_db_size_visibility.sql` to
    enable the DB-size panel.
  - Set up off-site backup destination (R2 recommended) and run
    the first manual `pg_dump` + `rclone` per the runbooks.
  - Schedule the quarterly restore drill.

---

## In progress on `claude/audit-15-a11y-deep`

- **15차 a11y deep dive (2026-05-27)** — 15 findings. This PR
  ships 7 safe-and-targeted fixes; complex modal focus-trap
  retrofits (F4 / F6) and the notif-menu arrow-nav (F9) deferred
  for careful work.
  - **A11Y-F1 (P0) — LANDED**: Study Room top tabs now have
    full ARIA tab semantics (`role="tablist"` + `role="tab"` +
    `aria-selected` + `aria-controls`). `switchSrTab()` syncs
    `aria-selected` on click so SR users hear which tab is
    active.
  - **A11Y-F2 (P0) — LANDED**: 4 more KR-heavy pages flipped
    `lang="en"` → `lang="ko"`: `index.html`,
    `korehan-study-room.html`, `korehan-onboarding.html`,
    `korehan-mypage.html`. VoiceOver / TalkBack now use the
    Korean speech engine.
  - **A11Y-F3 (P0) — LANDED**: onboarding "Skip setup for now"
    is now a real `<button type="button">` instead of a `<div>`.
    Focusable + Enter/Space-activatable.
  - **A11Y-F5 (P1) — LANDED**: password eye-toggle buttons in
    auth modal now have `type="button"` (no accidental form
    submit) + `aria-label="Show or hide password"`.
  - **A11Y-F8 (P1) — LANDED**: visible toast now carries
    `role="status"` + `aria-live="polite"` (or `assertive` for
    errors). Screen-magnifier users + SR users both perceive
    toasts.
  - **A11Y-F11 (P1) — LANDED**: 27 instances of `color: #94a3b8`
    in shared.css (contrast 2.85:1 — fails WCAG AA 4.5:1) bumped
    to `#64748b` (4.78:1 PASS) globally. Affects every "muted /
    secondary text" surface.
  - **A11Y-F15 (P2) — LANDED**: `.brk-track` breaking-news
    ticker now has an explicit `prefers-reduced-motion: reduce`
    opt-out that sets `animation: none` + `transform: none`
    (was relying on the global 0.01ms duration rule which left
    the ticker snapped mid-transform).

  **STILL OPEN from 15차**:
  - **A11Y-F4 (P0)**: Phone / Slang feature modals — no
    Escape, no focus trap, no opener restoration. Needs
    a per-modal retrofit (~6 feature modals to audit).
  - **A11Y-F6 (P1)**: `khAlert` / `khConfirm` / `khPrompt`
    lack focus trap + opener restore. Port the auth-modal
    pattern (sets `_khOpener` + Tab cycling).
  - **A11Y-F7 (P1)**: "Loading…" placeholders aren't in
    `role="status"` / `aria-live="polite"` regions. SR users
    sit silent during 5-30s Claude waits.
  - **A11Y-F9 (P1)**: Notif / profile dropdowns advertise
    `aria-haspopup="menu"` but the panels lack `role="menu"`
    + arrow-key nav. Either drop the haspopup hint or
    implement real menu semantics.
  - **A11Y-F10/F12/F13/F14**: touch-target 44×44, forced-colors,
    Turnstile timeout, data-action kbd activation. Defensive.

---

## On `claude/audit-14-i18n`

- **14차 i18n + browser compat (2026-05-27)** — 15 findings. This
  PR ships the safe targeted 5 (F3 / F5 / F4 / F7 / F9) +
  PERF-F10/F12 bonuses. Big i18n framework (F1 / F6 / F12 —
  i18n strings) deferred for owner decision.
  - **I18N-F3 (P0)**: auth inputs now have `autocomplete` +
    `name` + `inputmode` attributes — password managers
    autofill correctly across all 7 auth fields.
  - **I18N-F5 (P0)**: new `khImeActive(event)` helper. Every
    Enter handler in auth flow now skips submission while the
    Korean IME is mid-composition. Exported as `window.khImeActive`.
  - **I18N-F4 (P1)**: 7 Korean-primary content pages flipped from
    `lang="en"` to `lang="ko"` (korehan-article,
    korehan-conversations, korehan-stories, korehan-fun-chosung,
    korehan-fun-dictation, korehan-fun-worddrop,
    korehan-fun-sentence-order).
  - **I18N-F7 (P1)**: new `KH_KO_COLL = Intl.Collator('ko',
    {numeric: true, sensitivity: 'base'})` helper in shared.js
    for stable Hangul-aware sort.
  - **I18N-F9 (P1)**: `createImageBitmap` in avatar upload now
    falls back to `Image()` + canvas on iOS 14.
  - **PERF-F10 — bonus**: article-cache schema-detect probe now
    memoized in localStorage with 7-day TTL.
  - **PERF-F12 — bonus**: new `docs/db-performance.md` monthly
    slow-query review playbook.

  **STILL OPEN from 14차**:
  - **I18N-F1 / F6 / F12 (i18n strings)**: every UI string in
    shared.js is hardcoded English. Needs central KH_LOCALE +
    KH_T() lookup-table refactor. Biggest i18n project remaining.
  - **I18N-F2**: `new Date(iso)` Safari quirk. Targeted spot-fix
    if a real bug surfaces.
  - **I18N-F10/F13/F14 (P2)**: PWA manifest, `:has()` `@supports`
    guard, hreflang on index/landing.

---

## On `claude/audit-13-cost-monitoring` (PR #628 merged 2026-05-27)

- **13차 batch B — Anthropic cost monitoring (PERF-F7/F9/F13)**:
  - **Migration `20260527_audit_13_cost_monitoring.sql`** adds:
    - `claude_cost_daily` (date, feature, model) aggregate table
    - `_kh_claude_price_usd()` SQL function mirroring the TS
      MODEL_PRICING constants in claude-proxy
    - `aggregate_claude_costs_daily(days_back)` RPC — incremental
      upsert from claude_api_usage into claude_cost_daily
    - `claude_cost_by_feature_month` materialized view
    - `check_anthropic_budget_alert()` — MTD vs budget +
      3× daily-spike → critical client_errors row (= AN-F2
      Discord ping once owner deploys notify-critical-error)
    - `purge_old_claude_api_usage(days)` — retention, min 90d
      default 365d
  - **New admin tab "💵 Anthropic Cost Monitor"** (sidebar):
    - MTD + today's spend + 14-day timeline
    - Top features this month
    - Buttons: Run aggregation / Refresh feature rollup
      (alert-only, REFRESH MATERIALIZED VIEW can't go through
      PostgREST) / Check budget alert
  - Budget threshold: `app_settings.anthropic_monthly_budget_usd`
    defaults to $200 if not set. Owner can override:
    `INSERT INTO app_settings (key, value) VALUES
     ('anthropic_monthly_budget_usd', '50') ON CONFLICT
     (key) DO UPDATE SET value = EXCLUDED.value;`
  - **OWNER MUST**:
    1. Apply 20260527_audit_13_cost_monitoring.sql
    2. (Optional) set anthropic_monthly_budget_usd in app_settings
    3. After deploy, click "Run aggregation now" once to backfill
       (covers last 7 days)
    4. Run `REFRESH MATERIALIZED VIEW CONCURRENTLY
       public.claude_cost_by_feature_month;` in SQL editor to
       fill the per-feature view
  - **PERF-F15 (Supabase usage)**: deferred. Needs a Supabase
    Management API call from an Edge Function; not in scope this
    PR. Note in TODO for batch C.

---

## On `claude/audit-13-db-perf` (PR #627 merged 2026-05-27)

- **13차 audit batch A — Missing indexes + admin bulk-upsert + LIMITs (2026-05-27)**:
  Audit found 15 findings; this PR ships the safe high-impact P0+P1
  (indexes + N+1 fix + admin limits). PR-B (cost monitoring) and
  PR-F4 (articles select narrowing — high-risk per PR #526 schema
  drift lesson) deferred.
  - **PERF-F1 — LANDED**: `user_saved_words(user_id, created_at DESC)`
    index. Notes / Word Bank / Study Room reads on every page.
  - **PERF-F2 — LANDED**: `xp_log(user_id, created_at DESC)` index.
    My Page recent-XP read.
  - **PERF-F3 — LANDED**: FK indexes on `coin_transactions`,
    `owned_items`, `shop_purchases`, `payment_orders`. Account
    deletion's ON DELETE CASCADE was O(table_size) seq scan per
    referencing table.
  - **PERF-F11 — LANDED**: `user_stats(xp DESC NULLS LAST)` index
    for the admin leaderboard.
  - **PERF-F5 — LANDED**: admin vocab "Save All" bulk-upserts in
    one call. Previously 500-word edit session was 500 sequential
    round-trips (~25s); now <1s.
  - **PERF-F6 — LANDED**: `getArticleCacheVocab()` N+1 fix. Was
    one `getFromCache` call per article (80 round-trips per Learn
    page render). Now one `.in()` bulk query, grouped client-side.
    Per-article fallback retained for `wide` schema and on error.
  - **PERF-F8 + F14 + F11 — LANDED**: `.limit()` added to 5 admin
    listing queries (`articles`, `user_stats`, `daily_missions`,
    `newsletter_subs` at 2000, `newsletter_campaigns` at 200,
    `stories_data` bulk-translate at 500). Prevents 10k+ row
    sorts on every admin page-open.

  **STILL OPEN — batch B (cost monitoring):**
  - **PERF-F7 (P1)**: no aggregate Anthropic budget alert. Needs
    a daily Edge Function aggregating `claude_api_usage` →
    `claude_cost_daily` table + threshold webhook.
  - **PERF-F9 (P1)**: no per-feature cost rollup. Materialized
    view `claude_cost_by_feature_month` refresh-nightly.
  - **PERF-F13 (P2)**: `claude_api_usage` no retention policy.
    Monthly partitioning or 12-month rolling delete.
  - **PERF-F15 (P2)**: no Supabase free-tier usage visibility.
    Weekly cron via Supabase Management API.
  - All four blocked on CRON-F1 (no scheduler installed yet).
    Code can be written + admin button to manually trigger.

  **DEFERRED — needs careful design:**
  - **PERF-F4 (P1)**: `articles` table `select('*')` reverted to
    avoid the PR #526 schema-drift incident. Narrowing the
    explicit column list requires either (a) the post-deploy
    smoke test from incident-followups (P0 from CLAUDE.md), or
    (b) the schema-vs-code lint (P2 there). Wait for those.

  **STILL OPEN — minor:**
  - **PERF-F10 (P2)**: schema-detect probe memoization via
    localStorage. Trivial future win.
  - **PERF-F12 (P2)**: `docs/db-performance.md` checklist for
    `pg_stat_statements`-based monthly slow-query review.

---

## On `claude/audit-12-email`

- **12차 오딧 — Email deliverability + Resend integration (2026-05-27)**:
  Background audit found **15 findings**. Headline: no documented
  DKIM/SPF/DMARC, no bounce/complaint webhook (= reputation collapse
  within weeks), confirm tokens never expire, no demonstrable
  consent fields, English-only templates for KR subscribers.

  **CODE FIXES LANDED THIS PR (10 of 15):**
  - **EMAIL-F2 (P0)** confirm email had literal `${'this email'}`
    bug (looks like a templating crash = spam signal). Template
    now echoes the actual subscribed address.
  - **EMAIL-F4 (P1)** confirm tokens now have **48-hour TTL**
    (`confirm_token_expires_at` column + check in
    `newsletter_confirm` RPC). Existing rows backfilled.
  - **EMAIL-F5 (P1)** added GDPR Art 7(1) / PIPA Art 22
    demonstrable-consent fields: `consent_ip`,
    `consent_user_agent`, `consent_text_version`.
  - **EMAIL-F6 (P1)** hidden preheader prepended to campaign
    HTML so Gmail inbox preview shows the teaser instead of
    incidental text.
  - **EMAIL-F7 (P1)** explicit `Reply-To: hello@korehani.com`
    on every send.
  - **EMAIL-F8 (P1)** Resend 429 / 5xx now triggers a retry once
    with `Retry-After` (or 2-second default).
  - **EMAIL-F10 (P1)** test sends now include `List-Unsubscribe`
    + `Reply-To` — they were missing, which landed `[TEST]` sends
    in spam (defeating the purpose).
  - **EMAIL-F12 (P2)** unsubscribe.html distinguishes "already
    unsubscribed" from "link not recognized". RPC renamed to
    `newsletter_unsubscribe_by_token` with explicit status code.
  - **EMAIL-F13 (P2)** confirm email is now **bilingual** —
    picks locale from `newsletter_subs.locale`. KR subscribers
    get a fully translated message.
  - **EMAIL-F14 (P2)** plain-text fallback enforced via
    `htmlToPlainText(body_html)` at send time.

  **NEW EDGE FUNCTION (owner deploys):**
  - **EMAIL-F3 (P0)** `supabase/functions/resend-webhook/` —
    Svix-signed Resend webhook handler. Suppresses bounced /
    complained emails; logs critical to `client_errors`.

  **OWNER ACTION (DNS + dashboard, OUTSIDE the repo):**
  - **EMAIL-F1 (P0)** DKIM / SPF / DMARC. Full checklist in
    `docs/email-deliverability.md`. Without this, transactional
    emails (signup confirm, password reset) hit spam.
  - **EMAIL-F9 (P1)** move `RESEND_API_KEY` from
    `app_settings.resend_key` (admin-readable) to Supabase
    Function secret.

  **DEPLOY ORDER:**
  1. Apply `20260527_audit_12_email_hardening.sql`
  2. Configure DNS + Resend domain verification (docs/email-deliverability.md §1-2)
  3. `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...`
  4. `supabase functions deploy resend-webhook --no-verify-jwt`
  5. `supabase functions deploy newsletter-send`
  6. Smoke-test per docs/email-deliverability.md §5

  **STILL OPEN:**
  - **EMAIL-F11 (P2)** account-deletion email round-trip
    confirmation. PRIV-F6's "type your email" check is enough
    friction for most cases; full email confirmation needs new
    `delete_request` table + Edge Function. Worth doing
    eventually.
  - **EMAIL-F15 (P2)** SRI on jsdelivr Supabase SDK. Skipped —
    every SDK upgrade requires recomputing the hash; defensive
    value low on public landing pages.

- **MOD-F12** also landed on this branch in an earlier commit.
  See PR description for the full Recent UGC sweep tab.

---

## On `claude/mod-fixes-read-filtering`

- **11차 batch B2 — Block-filtered reads + nickname attr-XSS (2026-05-26)**:
  - **MOD-F6 (P1) — LANDED**: replaced `comments` SELECT policy
    `USING (true)` with one that filters by `user_blocks`
    bidirectionally for authenticated viewers. Anon still sees
    everything (SEO requirement). Push-down via RLS means every
    existing frontend SELECT inherits the filter without code
    change.
  - **MOD-F9 (P1) — LANDED**: tightened `user_stats` SELECT
    policy to authenticated-only + block filter. Defensively DROPs
    any drift policy (production had an "anon read" policy NOT
    in the in-tree migration history). Anonymous visitors viewing
    `/korehan-profile.html?id=X` now see "profile not available"
    instead of full xp/streak. Authenticated viewers see own row
    + non-blocked rows.
  - **MOD-F11 (P1) — LANDED**: `_escapeHtml(currentName)` applied
    at `korehan-mypage.html:1982` Change-Nickname modal. Was
    interpolating raw textContent into `value="..."` attribute —
    attribute-context XSS if a display_name ever contained `"`.
    Display-name trigger (MOD-F3) blocks zero-width / RTL / admin
    impersonation but NOT quote chars in legitimate names like
    `He said "hi"`.

  **STILL OPEN from 11차**:
  - **MOD-F12 (P2)**: admin UGC queue beyond comments — guestbook,
    reporter_posts, user_submissions, recently-changed
    display_names. Owner-defined "Recent UGC" sweep tab. Lower
    priority since the report-queue (batch B1) already surfaces
    flagged content.
  - NSFW scan (paid external service): deferred.

---

## On `claude/mod-fixes-reports` (PR #624 merged 2026-05-26)

- **11차 batch B1 — Report pipeline + Soft-delete (2026-05-26)**:
  - **MOD-F2 (P0) — LANDED**: full report pipeline. New
    `content_reports` table + `report_content(target_type,
    target_id, reason, detail)` SECURITY DEFINER RPC + new admin
    "🚩 Report Queue" tab in `korehan-x9f4k2m7.html`. Reports
    dedup on `(target_type, target_id, reporter_id)`. Admin
    queue shows pending reports with the original comment snippet
    inline (pulled via the new `content_original` column from
    MOD-F7), plus three actions: Dismiss / Mark Reviewed / Hide
    Comment (the last cascades into `soft_delete_comment`).
    Self-reports are rejected at the RPC. Frontend
    `reportComment()` in `comments.js` rewritten to call the
    RPC; the localStorage hide is kept as a UX backstop so the
    reporter doesn't keep seeing the offending content while
    admin reviews.
  - **MOD-F7 (P1) — LANDED**: comments now soft-delete via
    `soft_delete_comment(id)` SECURITY DEFINER RPC instead of
    hard DELETE. Adds `deleted_at`, `deleted_by`,
    `content_original` columns to `comments`. Author self-delete
    replaces content with `[Deleted by author]`; admin delete
    replaces with `[Removed by moderator]`; original text is
    preserved in `content_original` for the admin queue (so a
    harasser can't delete-then-deny). Replies stay coherent.
  - **`admin_resolve_report(report_id, action, note)`** RPC —
    admin gate via `is_admin_email()`. Action ∈ dismiss /
    reviewed / hide_comment. The hide_comment action cascades
    into `soft_delete_comment`.

  **STILL OPEN from 11차 (batch B2 planned):**
  - **MOD-F6 (P1)**: blocked-user visibility in comment / profile /
    search reads. Needs RPC wrappers (`get_visible_comments`,
    `search_users`) that JOIN against `user_blocks`.
  - **MOD-F9 (P1)**: `user_stats` anon SELECT scrape risk. Revoke
    anon SELECT + introduce `get_public_profile(user_id)` RPC.
  - **MOD-F11 (P1)**: residual nickname XSS sites — verify no
    remaining HTML interpolations use raw `display_name` (the
    DB trigger from batch A blocks new bad names, but existing
    rows + other display surfaces still need an audit).
  - **MOD-F12 (P2)**: admin UGC queue beyond comments
    (guestbook / reporter_posts / writing submissions).
  - NSFW scan: deferred (paid external service).

---

## On `claude/mod-fixes-storage` (PR #623 merged 2026-05-26)

- **11차 batch A — Storage + Validation + Rate-limit (2026-05-26)**:
  Six 11th-audit findings bundled (DB-heavy surfaces) — all owner-
  applicable without UX decisions.
  - **MOD-F4 (P0) — LANDED**: avatars bucket migration sets
    `allowed_mime_types = ['image/jpeg','image/jpg','image/png',
    'image/webp']` + `file_size_limit = 2 MB`. Frontend now
    re-encodes uploaded images via `createImageBitmap` + canvas
    (strips ALL EXIF including iPhone GPS coords; normalizes to
    JPEG; caps at 512×512). The data: URL fallback (which used
    to balloon JWT and render multi-MB inline images everywhere)
    is REMOVED — upload failure now shows a retry toast and bails.
  - **MOD-F8 (P0) — LANDED**: reporter-images bucket migration
    same shape (`allowed_mime_types` + `5 MB cap`). Previously
    any authenticated user could upload arbitrary binaries
    (mp4/exe/SVG with embedded JS) and link to them via
    `public: true` — KoreHani's domain was a free file-hosting
    CDN. Locked to image MIME only.
  - **MOD-F5 (P0) — LANDED**: new `submit_comment(article_id,
    content, parent_id)` SECURITY DEFINER RPC. Enforces server-
    side 15-second cooldown via `max(created_at) where user_id =
    auth.uid()` — un-bypassable from a second tab. Strips
    zero-width / RTL-override chars as a backstop. Pulls
    display_name + avatar from user_stats canonically. Frontend
    `submitComment` + `khCmSubmitReply` rewritten to call this
    instead of direct INSERT.
  - **MOD-F3 (P0) — LANDED**: `_validate_display_name()` trigger
    on user_stats INSERT/UPDATE of display_name. Rejects reserved
    impersonation patterns (관리자 / 운영자 / Admin / KoreHani
    Staff / etc.) case-insensitively. Strips zero-width + RTL
    chars. Length-caps at 30. Profanity wordlist intentionally
    deferred — owner should curate Korean profanity content;
    impersonation block is the highest-value part.
  - **MOD-F13 (P1) — LANDED**: `notify_comment_reply` now skips
    the notification insert when either side has blocked the
    other (bidirectional `user_blocks` join). Previously a
    blocked user could "ping-bomb" the target by replying to
    their old comments.
  - **MOD-F14 (P2) — LANDED**: `post_guestbook` no longer stores
    `left(msg, 80)` preview in `notifications.payload`. Now just
    `guestbook_id` — bell-dropdown UI fetches the message live
    (deletes propagate, no leak path if push notifications
    are ever wired).
  - **MOD-F10 (P1) — LANDED**: frontend `_khStripInvisible()` in
    comments.js removes zero-width / RTL-override / BOM chars
    before length / spam checks. Backstop for the server-side
    strip inside `submit_comment` RPC.

  **STILL OPEN from 11차 (batch B planned):**
  - **MOD-F2 (P0)**: report/flag pipeline (no DB table yet).
  - **MOD-F6 (P1)**: blocked-user visibility in comment / profile /
    search reads.
  - **MOD-F7 (P1)**: comments hard-delete loses audit trail —
    needs soft-delete (deleted_at, deleted_by, content_original).
  - **MOD-F9 (P1)**: `user_stats` anon SELECT enables PII scrape.
  - **MOD-F11 (P1)**: nickname attr-context XSS (mostly covered
    by MOD-F3 now; verify no remaining sites use innerHTML on
    raw display_name).
  - **MOD-F12 (P2)**: admin UGC queue beyond comments (guestbook,
    reporter_posts, writing submissions).
  - **MOD-F15 (P2)**: avatar `data:` URL fallback unbounded —
    **fixed in this PR via MOD-F4 (removed the fallback entirely)**.
  - NSFW scan (Sightengine / Cloudflare Images): deferred —
    paid external service.

---

## On `claude/audit-11-moderation` (PR #622 merged 2026-05-26)

- **11차 오딧 — Content moderation + UGC safety (2026-05-26)**:
  Background audit found **15 findings**. Headline: stored XSS in
  admin comments queue (DB-level compromise risk) + zero report→
  review→action pipeline + no rate-limiting on comments + reserved-
  name impersonation possible.
  - **MOD-F1 (P0) — LANDED THIS PR**: stored XSS in
    `korehan-x9f4k2m7.html:8291` admin comments queue. Was
    interpolating user-controlled `user_name` / `content` / `reply`
    raw into innerHTML AND into a `<textarea>` body. A commenter
    posting `</textarea><script>fetch(evil)</script>` would own
    the admin session on next 💬 Comment Management open — admin
    context = service-role = full DB compromise. Routed every
    interpolation through `esc()`. Added `white-space:pre-wrap`
    for newline preservation.
  - **MOD-F2 (P0) — STILL OPEN**: no report/flag pipeline (only
    localStorage). Needs `content_reports` table + RPC + admin
    queue view. Separate PR.
  - **MOD-F3 (P0)**: no display-name validation (impersonation +
    profanity). Needs server-side trigger.
  - **MOD-F4 (P0)**: avatar upload no server-side MIME/size/EXIF
    defense. Needs bucket migration + EXIF strip.
  - **MOD-F5 (P0)**: no server-side comment rate-limit. Needs
    SECURITY DEFINER RPC.
  - **MOD-F6–F15** — P1/P2 items in TODO (blocked-user visibility,
    soft-delete, reporter-images bucket, RTL injection, etc.).

- **Article-gen JSON-parse bug (user-reported, 2026-05-26) —
  LANDED THIS PR**: Owner sent a screenshot showing "Generate
  Adapted Articles" failing with "Unexpected non-whitespace
  character after JSON at position 1398 line 13 col 1". Root
  cause: the cleanup at `korehan-x9f4k2m7.html:5443-5444` only
  stripped markdown fences then `JSON.parse`'d directly — broke
  when Sonnet appended explanatory prose after the closing brace.
  Replaced with the daily-content-gen pattern: find first `{`,
  slice to last `}`, parse → repair-trailing-commas → parse.

- **PRIV-F9 (P1) — LANDED THIS PR**: age gate on onboarding.
  Single "I confirm I am 14+ (16+ EU)" checkbox above the finish
  button. Blocks `finishOnboarding()` if unchecked. Stamps
  `localStorage.kh_age_confirmed_at` for audit. KISA-recommended
  PIPA-22-2 / GDPR-Art-8 lightweight pattern.

---

## On `claude/audit-11-moderation` (PR #621 merged — PRIV-F7)

- (PRIV-F7 client_errors PII scrub landed via PR #621; details
  retained earlier in this file.)

---

## On `claude/priv-fixes-batch-2` (PR #620 merged 2026-05-26)

- **10차 GDPR/PIPA batch 2 (2026-05-26)** — second round closing
  the remaining big-ticket items from audit 10:
  - **PRIV-F3 (P0) — LANDED**: new `export-my-data` Edge Function
    + "Download my data" button in My Page. Returns a JSON blob
    of every user-owned row across the same table set
    `delete-account` touches, plus storage manifests (filenames +
    sizes only; raw audio/avatar bytes not embedded). Documents
    what's NOT included in a `notes` array. GDPR Art 15/20 + PIPA
    Art 35 열람권 satisfied.
  - **PRIV-F4 (P0) — FULLY CLOSED**: previous PR sent obfuscated
    email hint to Discord (`a***@gmail.com`). Still arguably
    linkable. This PR drops the email field entirely; Discord
    payload is now just provider + user_id + verified + timestamp.
    Admin can look up full email/name in the local
    signup_notifications_log (not cross-border).
  - **PRIV-F5 (P0) — LANDED (manual purge for now)**:
    `purge_old_signup_pii(p_age_days int)` stored procedure that
    nulls `email + name` on `signup_notifications_log` rows older
    than N days (default 90, minimum 30). service_role-only. Owner
    runs ad-hoc via `SELECT public.purge_old_signup_pii();` until
    pg_cron is installed (CRON-F1 still open).
  - **PRIV-F6 (P1) — LANDED**: account-deletion flow now requires
    typing the account email to confirm. Stolen-active-session
    attackers must know the email — they often do, so this isn't
    bulletproof, but it adds friction beyond click-through and
    catches accidental clicks. Native `window.prompt` (intentional
    — a bespoke modal would be a lot of code for one rare flow).
  - **PRIV-F8 (P1) — LANDED**: new `privacy-policy-ko.html`
    covering all PIPA Art 30 required sections in Korean
    (수집항목, 이용목적, 보유기간, 처리위탁, 국외이전, 이용자
    권리, 14세 미만 처리, 안전성 조치, 보호책임자 + KISA/Privacy
    Commission contact list). Cross-linked from English policy
    header. Note: this is a focused first draft — owner may want
    legal-review refinement.
  - **PRIV-F11 (P1) — LANDED**: dropped the unenforceable
    "deleted within 30 days" promise from privacy-policy.html
    (lines 355 + 440). Changed to GDPR Art 17(1)'s "without
    undue delay" language. Response-time promises ("we respond
    within 30 days to your request") are kept — those are
    GDPR Art 12(3)'s actual requirement.
  - **PRIV-F12 (P1) — LANDED**: corrected the inconsistent
    payment-retention statement ("7 years" was wrong for KR
    users — Korean E-Commerce Act Art 6 mandates 5 years).
    Updated to "5 years per the Korean E-Commerce Act / Act on
    Consumer Protection in Electronic Commerce, Article 6".
    Speaking Coach v3 currently unused so no actual rows exist;
    if/when payments go live the deletion path needs to
    anonymize-in-place instead of cascade-delete.
  - **PRIV-F14 (P2) — LANDED**: cookie/consent banner now fires
    on `korehan-onboarding` too. Previously suppressed there —
    meaning the highest-engagement step ran without ever asking
    for consent and the banner only appeared on the NEXT page.
  - **PRIV-F15 (P2) — LANDED (minimum-effort)**: Owner doesn't
    have EU/UK contacts to designate as Art 27 representative.
    Added a section to the English privacy policy explaining
    that EU/UK residents may contact `hello@korehani.com`
    directly and we commit to the statutory 30-day response.
    NOT fully compliant — a designated rep is the proper fix
    (e.g. VeraSafe paid service) — but reduces exposure until
    owner picks a service.

- **STILL OPEN from 10차**:
  - **PRIV-F7 (P1)**: `client_errors.stack` + `context` scrubbing.
    Non-trivial — needs a stack-trace scrubber + cascade-delete
    on user removal (currently ON DELETE SET NULL leaves orphan).
  - **PRIV-F9 (P1)**: age gate on onboarding (≥14 PIPA, ≥16 GDPR).
    UX decision pending.
  - **PRIV-F15 follow-up**: when feasible, designate a real EU/UK
    Art 27 representative via VeraSafe / Bird & Bird / etc.

---

## On `claude/priv-fixes-p0` (PR #619 merged 2026-05-26)

- **10차 오딧 — GDPR + PIPA compliance (2026-05-26)**:
  15 findings. P0 items (5): missing voice/avatar erasure, newsletter
  persistence post-delete, no data-export endpoint, Discord PII
  cross-border transfer, signup_notifications_log retention.
  - **PRIV-F1 — LANDED THIS PR**: `delete-account` now enumerates
    and removes per-user files from `speaking-recordings/speaking/<userId>/`
    (voice recordings) and `avatars/<userId>/` (avatar images).
    Right-to-erasure now covers binaries, not just rows. Per-bucket
    error tolerant — won't fail-fast on a missing bucket.
  - **PRIV-F2 — LANDED THIS PR**: `newsletter_subs` is keyed by
    email, not user_id. The previous USER_KEYED_TABLES loop was
    silently no-opping (.eq('user_id', userId) on a non-existent
    column). Captured `userData.email` from the JWT verification
    response and added an explicit email-keyed delete. Removed
    `newsletter_subs` from the user-id loop to avoid confusion.
  - **PRIV-F10 — LANDED THIS PR**: `confirmDeleteAccount()` in
    `korehan-mypage.html` was pre-deleting 3 tables client-side
    then showing "Data deleted" even when the Edge Function
    returned 500. Removed the pre-delete (Edge Function is the
    authoritative cleanup) and the success message now only fires
    on `res.ok && body.ok === true && body.auth_delete.ok === true`.
    Sign-out is also gated on full success so a partial failure
    leaves the user signed in for retry.
  - **PRIV-F13 — LANDED THIS PR**: dropped `access_type: 'offline'`
    from Google OAuth signInWithOAuth queryParams. KoreHani only
    needs one-shot login, not a long-lived refresh token. Aligns
    with GDPR Art 5(1)(c) data minimisation.
  - **PRIV-F4 — LANDED THIS PR (partial)**: `notify-signup` Discord
    webhook now sends only an obfuscated email hint (`a***@gmail.com`)
    + provider + user_id + verified status + timestamp. Raw email
    and name no longer cross-border to US-hosted Discord. The
    signup_notifications_log row still carries email+name for
    admin dashboard purposes (local DB, not cross-border).

  **STILL OPEN P0/P1 (need owner decisions or non-trivial work):**
  - **PRIV-F3 (P0)**: no data-export endpoint exists, but privacy
    policy promises Art 15 / Art 20. Needs Edge Function
    `export-my-data` that JSON-dumps the same set of tables
    `delete-account` touches.
  - **PRIV-F5 (P0)**: `signup_notifications_log` retains email+name
    indefinitely. Needs a retention job (depends on CRON-F1
    scheduler) or null-the-PII trigger.
  - **PRIV-F6 (P1)**: no re-auth before account deletion. Stolen
    active session = account destruction. Needs UX flow: password
    re-entry for email users, email-confirm token round-trip for
    Google OAuth.
  - **PRIV-F7 (P1)**: `client_errors.stack` + `context` likely
    carry PII; ON DELETE SET NULL leaves orphaned data. Needs
    stack-trace scrubber + cascade-delete on user removal.
  - **PRIV-F8 (P1)**: no Korean-language privacy policy. PIPA
    Art 30 requires it for KR-targeting services.
  - **PRIV-F9 (P1)**: onboarding has no age gate. PIPA Art 22-2
    requires ≥14 confirmation; GDPR Art 8 ≥16 in most EU.
  - **PRIV-F11 (P1)**: 30-day deletion promise unenforceable (no
    cron for dormant accounts). Drop the promise or implement it.
  - **PRIV-F12 (P1)**: payment retention conflict (5y per PIPA
    transaction record vs immediate delete in code). Owner needs
    to decide: hash+keep in `payment_audit` table, or update
    policy to match code.
  - **PRIV-F14 (P2)**: cookie banner suppressed on onboarding.
    Move to onboarding step 1.
  - **PRIV-F15 (P2)**: no EU/UK GDPR Art 27 representative listed
    despite EU users.

---

## On `claude/audit-10-gdpr-pipa` (PR #618 merged 2026-05-26)

- **CRON-F7 — LANDED THIS PR**: `daily-content-gen` lock TTL
  raised from 5 min to 15 min. The old 5 min was shorter than
  worst-case Anthropic latency × 8 concurrent calls (Sonnet at
  3,000 tokens on Advanced has observed 30–60s tails). A pg_cron
  retry after 5 min would have seen a "stale" lock, overwritten
  it, and fired a second concurrent generation that races the
  first on the same `(scheduled_date, level)` upserts.

- **CRON-F13 — LANDED THIS PR**: writing-topics rotation epoch
  was hardcoded in 7 places (2 in `daily-content-gen/index.ts`,
  5 in `korehan-x9f4k2m7.html`). A maintainer tweaking one (e.g.
  to skip a corrupted topic batch) would silently desync admin
  "preview today's topic" from cron generation. Extracted to a
  single constant per file:
  - `WRITING_TOPICS_EPOCH_ISO` in `daily-content-gen/index.ts:24`
  - `KH_WRITING_TOPICS_EPOCH` in `korehan-x9f4k2m7.html:415`
  Keep them in sync if the epoch ever needs to move.

---

## On `claude/cron-f6-prompt-cache` (PR #617 merged 2026-05-26)

- **CRON-F6 — prompt-caching on `daily-content-gen` (2026-05-26)**:
  Refactored `buildPrompt()` to return `{staticPrefix, dynamicSuffix}`
  instead of a single string. The static prefix (~1800–2200 tokens
  of grammar rules + JSON schema + counts — identical for every
  call of the same level) is now sent with
  `cache_control: {type: 'ephemeral'}` as the first content block;
  the dynamic suffix (per-call topic hint) follows after the cache
  boundary.
  - Concurrent `Promise.allSettled` fan-out (8 items per run) still
    pays full price on the first wave because all calls hit
    Anthropic before any cache write commits — per
    `shared/prompt-caching.md`'s docs on parallel requests.
  - Real wins: admin retries within 5-min TTL pay ~10% of full
    input cost; future serialization (e.g. moving to single-fire-
    then-fan-out pattern) becomes a 1-line config flip.
  - Expression / situation prompt caching in `pregenKeyExpressions`
    skipped — those calls also run concurrent in the same fan-out,
    so caching them would add complexity for no realistic gain
    until the serialization refactor lands.

- **SEO-F5 extension — stories + conversations dynamic OG (2026-05-26)**:
  Built on top of the `khUpdatePageMeta()` utility shipped in
  PR #616. Now `openStory(id)` and `openDetail(idx)` (conversation
  detail open) both rewrite `document.title` / meta description /
  og:* / twitter:* / canonical to reflect the actual story or
  conversation that's open. Social shares of
  `/korehan-stories.html?id=X` and `/korehan-conversations.html?id=Y`
  no longer show the generic placeholder OG card.
  Sections (`korehan-section.html?s=...`) still use static placeholder
  — those are list views (not single items) so the SEO win is
  smaller; deferred.

---

## Recently merged

### `claude/audit-9-cron` (PR #616 merged 2026-05-26)

- **9차 오딧 — Cron / scheduler reliability (2026-05-26)**:
  Background audit found **15 findings**. The headline ones:
  - **CRON-F1 (P0) — STILL OPEN, OWNER ACTION**: there is **no
    cron scheduler at all**. No `pg_cron`, no GitHub Actions cron,
    no Cloudflare scheduled function, no external scheduler.
    `daily-content-gen` only fires when admin clicks a button in
    `korehan-x9f4k2m7.html`. Any day admin forgets, every learner
    across all 4 TOPIK levels sees zero new content. The function's
    own header comment says "runs on cron schedule" but the
    schedule was never installed. **Fix shape:** migration that
    installs pg_cron + `cron.schedule('daily-content-gen', '0 15
    * * *', $$ select net.http_post(...) $$)` (15:00 UTC =
    00:00 KST). Needs CRON_SECRET in vault.
  - **CRON-F2 (P0) — STILL OPEN, OWNER ACTION**:
    `assign_daily_vocab()` RPC referenced by `learning_hub_client.js`
    and CLAUDE.md does not exist in any migration. Every call
    silently returns "function does not exist" → learners never
    get their 20-word daily pool. Needs owner clarification on
    intended schema/behavior before writing.
  - **CRON-F3 (P1) — DEFERRED (Discord)**: `daily-content-gen`
    swallows per-item failures, never writes to `client_errors`.
    notify-critical-error plumbing exists but doesn't get called.
    Owner asked to hold Discord work.
  - **CRON-F4 (P1) — STILL OPEN, NEEDS OWNER SCHEMA INFO**:
    `claim_streak_award` trusts client-supplied `p_streak`.
    Exploit: user calls with `p_streak: 365` → instant 3 freezes
    + permanent reward-lockout. Server-side recompute needs the
    `user_read_history` schema which isn't in the in-tree
    migrations.
  - **CRON-F5 (P1) — LANDED THIS PR**: `getCurrentStreak()` at
    `korehan-shared.js:9520` walked dates in UTC, not KST.
    Between 15:00–23:59 UTC (= 00:00–08:59 KST) the walker's
    "today" was one day behind the activity tracker, so every
    Korean user who opened the app in the morning silently
    dropped their streak by a day. Walker now starts from
    `Date.now() + 9*3600000` and steps in 24-hour millisecond
    increments.
  - **CRON-F9** — investigated, turned out theoretical. No
    periodic re-render driver exists in the home or study-room
    pages; the day-hash compute happens once on DOMContentLoaded
    so the midnight-race scenario doesn't materialize. Skipped.
  - **CRON-F6/F7/F8/F10/F11/F12/F13/F14/F15** — P1/P2 items
    documented for later rounds (prompt-caching, lock TTL,
    notify retry-driver, retention jobs, cron_runs observability
    table, hardcoded epoch, KST envelope docs, consistency helper).

- **SEO-F5 (7차 P1) — LANDED THIS PR**: dynamic OG meta for the
  article-detail page. Previously every `?id=X` link shared the
  same generic "KoreHani — Article" preview card on
  Slack/Twitter/KakaoTalk. Added a `khUpdatePageMeta()` utility
  in `korehan-shared.js` that rewrites `document.title`,
  `<meta name="description">`, all `og:*` / `twitter:*`, and
  `<link rel="canonical">`. `renderArticlePage()` now calls it
  with the actual article's title/summary/image/URL right after
  the fetch resolves. Stories / conversations / sections still
  use the static placeholder — follow-up can add the same call
  to their render paths.

---

## Recently merged

### `claude/seo-p1-mechanical` (PR #614 merged 2026-05-26)

- **SEO P1 leftovers landed this PR (2026-05-26)** — mechanical
  fixes to the 4 remaining structural findings from the 7th audit:
  - **SEO-F4**: `korehan-mypage.html` + `korehan-learning-overview.html`
    got their `<meta name="description">` and a hidden `<h1>` (sr-only).
    Both pages were SEO-invisible before (no description, no h1).
  - **SEO-F6**: index / news / article / character / reporter all had
    zero `<h1>` — added one hidden h1 to each. Hero `<div>`s are
    untouched (no visual change).
  - **SEO-F7**: `korehan-courses.html` had 2× h1. Demoted the
    "Weekly Live Review" section title (line 606) from h1 to h2;
    matching CSS selector updated accordingly.
  - **SEO-F10**: `index.html` title (78 chars Korean + English) +
    description (240 chars bilingual) exceeded SERP truncation
    limits. Trimmed title to "KoreHani — Learn Korean Through Real
    News" (44 chars) and description to 155 chars English-only.
    Korean discoverability is preserved through other pages with
    `lang="ko"`.
  - **`.kh-sr-only` utility class** added to `korehan-shared.css` —
    standard visually-hidden / screen-reader-readable pattern that
    doesn't break flow or focus. Will be reusable for future hidden
    h1 / form-label needs.
  - **Cache-buster bumped** on `korehan-shared.css` from `?v=20260525i`
    → `?v=20260526a` across all 41 HTML pages that include it
    (lessons from PR #526 / CLAUDE.md "Past Incidents").

---

## On `claude/audit-9-next` (PR #613 merged)

- **AN-F2 (7차 P0) — Discord webhook on critical client_errors (2026-05-26)**:
  Now that AN-F3's `severity` column is live, critical-severity
  rows (currently emitted by `speaking_coin_unredeemed`,
  speaking-pass-webhook signature failures, refund-shortfall events,
  and any future server-side error site) fire a real-time Discord
  alert via a new `notify-critical-error` Edge Function.
  - Flow: critical INSERT → frontend `kh_log_error` (or webhook
    `logServerError`) captures the new row id via `.select('id')
    .single()` → fire-and-forget POST to `/functions/v1/
    notify-critical-error` with `{id:N}` → that function atomically
    claims the row via `UPDATE ... WHERE id=N AND severity='critical'
    AND notified_at IS NULL RETURNING *` (so concurrent retries
    can't double-notify) → POSTs sanitized payload to the configured
    Discord webhook.
  - Defense-in-depth: caller only supplies the row id. The function
    re-fetches the row server-side and refuses to notify on
    anything that isn't severity='critical', so a forged caller
    can't spam the operator by passing a low-severity row's id.
  - **OWNER MUST DO** (in order):
    1. Apply migration `20260526_audit_7_client_errors_notified_at.sql`
       (adds `notified_at` column + partial index for unnotified
       critical rows).
    2. Create a Discord webhook URL (Discord server → Settings →
       Integrations → Webhooks → New) and copy the URL.
    3. Insert into `app_settings`:
       ```sql
       INSERT INTO app_settings (key, value)
       VALUES ('error_notify_webhook', '<https://discord.com/api/webhooks/...>')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
       ```
    4. Deploy: `supabase functions deploy notify-critical-error`
    5. Redeploy `speaking-pass-webhook` (the `logServerError`
       helper was updated to fire the notification too).
  - Future critical-severity sites to instrument (suggested):
    auth-bypass attempts, OAuth signature mismatches, daily-content-gen
    cron failures, payments webhook signature failures (already
    instrumented), admin RLS bypass attempts.

---

## In progress on `claude/audit-8-payments`

> **⚠️ STATUS UPDATE (owner confirmed 2026-05-26): Speaking Coach
> v3 wallet feature is NOT used in production.** The `_startCoinCheckout`
> / `_showBuySpeakingCoinsModal` code paths in `korehan-study-room.js`
> and the `speaking-pass-webhook` / `speaking-pass-checkout` Edge
> Functions exist in the codebase but are not operationally live
> (no migrations applied → `speaking_coin_purchases` /
> `user_speaking_coins` tables do not exist in production →
> attempting to apply `20260526_audit_8_refund_handler.sql` errors
> with `42P01: relation "public.speaking_coin_purchases" does not
> exist`).
>
> All 8th-audit fixes (PAY-F1/F3/F4/F6/F15) have **landed in code
> as defensive scaffolding** and will activate IF/WHEN the feature
> launches. The 2 migrations that *did* apply cleanly (PAY-F2
> coin TOCTOU locks, AN-F3 client_errors severity) are about
> tables that ALREADY EXIST in production and are operational —
> those benefit the live shop / nyang / hover-vocab paths.
>
> **Migrations pending feature launch (do NOT apply unless turning
> on Speaking Coach v3):**
> - `20260422_speaking_coach_wallet.sql` (the prerequisite — creates
>   the tables + grant_speaking_coins RPC)
> - `20260526_audit_8_refund_handler.sql` (the audit-8 follow-up —
>   adds refund columns + revoke_speaking_coins RPC)
>
> If Speaking Coach v3 is being formally deprecated, a follow-up
> PR should remove the dormant UI / JS / Edge Function code to
> shrink the codebase. Awaiting owner confirmation before touching.

- **8차 오딧 — Payments + Stripe reliability (2026-05-26)**:
  - **Code fixes landed this PR (frontend + edge function)**:
    - **PAY-F4 (P0)** `_startCoinCheckout` now wraps the Stripe
      checkout fetch in an `AbortController` with a 20s timeout.
      Without it a wedged Edge Function left the user staring at
      "Opening secure checkout…" forever and second-clicking could
      double-fire two Stripe sessions.
    - **PAY-F15 (P2)** `?coach_coins=ok` redirect handler no longer
      blindly claims success. It now snapshots wallet balance before
      the refresh and only shows "Coach coins added!" if the balance
      actually went up (defense against phishing referral-bonus
      scam links). Falls back to neutral "Wallet refreshed" otherwise.
    - **PAY-F6 (P1)** `speaking-pass-webhook` now persists
      signature failures, missing-metadata events, and RPC errors
      to `client_errors` (severity='critical'). They survive past
      the Supabase 1-7 day log retention window so the operator
      can actually see them.
    - **PAY-F3 (P0)** `speaking-pass-webhook` catches PostgREST
      error code `23503` (FK violation) when `auth.users` row has
      been deleted and returns 200 + critical-severity client_error
      row with `action_required: 'refund or hand-grant after
      restoring user'` instead of 500 (which made Stripe retry for
      3 days then dead-letter the payment).
    - **AN-F3 (7차 P0)** `kh_log_error()` now accepts a third
      `severity` argument (debug/info/warn/error/critical). Default
      'error' preserves existing call sites. `speaking_coin_unredeemed`
      now logs as 'critical' — that's the textbook revenue-loss
      case (user charged for coin but didn't get the service).
  - **DB migrations OWNER MUST APPLY (Supabase SQL editor / `supabase db push`)**:
    - **`20260526_audit_7_client_errors_severity.sql`** — adds
      `severity` column with CHECK constraint + partial index on
      error/critical rows. Frontend writes to this column on every
      `kh_log_error()` call, so the migration MUST land before the
      next korehan-shared.js deploy or all error logging will fail
      (INSERT with unknown column).
    - **`20260526_audit_8_coin_toctou_locks.sql`** — adds
      `FOR UPDATE` row locks to `purchase_coin_shop_item` and
      `admin_adjust_coin`. Without it, two concurrent purchase
      calls from the same user can both succeed on the same
      balance (double-spend with 100 coins → two 100-coin items).
      The audit also flagged `send_reporter_gift` and the room-state
      RPC but on second inspection they already use `FOR UPDATE` —
      only those two needed fixing. Idempotent — safe to re-run.
  - **PAY-F1 (P0) — LANDED in follow-up PR (claude/audit-8-payments-refund)**:
    `speaking-pass-webhook` now subscribes to `charge.refunded` +
    `charge.dispute.created` + `payment_intent.canceled`.
    `charge.refunded` looks up the originating Checkout Session via
    Stripe API, then calls the new `revoke_speaking_coins` RPC
    (atomic, FOR UPDATE on purchase + wallet, idempotent on
    `stripe_refund_event_id`). Handles full + partial refunds and
    the "user already spent coins" edge case — deducts what we can
    and logs `shortfall > 0` as a critical client_errors row for
    operator reconciliation. `charge.dispute.created` logs critical
    (no coin movement yet — that fires when the dispute concludes
    as a refund). `payment_intent.canceled` is a no-op (we never
    granted coins on a pre-completion cancel).
    Companion migration: `20260526_audit_8_refund_handler.sql` —
    adds `refunded_at`, `refunded_amount_cents`,
    `stripe_refund_event_id`, `refund_note`, `coins_revoked`,
    `coins_shortfall` columns + `revoke_speaking_coins` RPC.
    OWNER MUST APPLY migration + redeploy webhook + register the
    new events in the Stripe dashboard endpoint settings.
  - **PAY-F5 P1 (email case mismatch), PAY-F7 P1 (no checkout
    funnel tracking — duplicates AN-F7), PAY-F9 P2 (no user-visible
    purchase history, PIPA risk), PAY-F11 P2 (event.id dedup),
    PAY-F12 P2 (USD/KRW currency clarity), PAY-F13 P2 (no
    consumption ledger)** — left as P1/P2 TODOs.

---

## Recently merged (claude/new-session-KCAZ7 — PR #608, #609)

- **7차 오딧 — SEO + Analytics + Sonnet→Haiku plan (2026-05-26)**:
  - **SEO fixes landed this PR (mechanical, low-risk)**:
    - **SEO-F1** og-default.png was 404 on 7 pages → repointed all
      `og:image` / `twitter:image` from
      `https://korehani.com/og-default.png` →
      `https://korehani.com/img/guide/hero-express.png` (existing
      asset). Share previews now render.
    - **SEO-F2** robots.txt expanded the default-policy Disallow
      list: admin (-errors, -schema), tutor (-7v3ca), auth-gated
      (mypage, profile, onboarding, confirm/unsubscribe), preview
      (onboarding-preview-compact).
    - **SEO-F3** landing.html (the most-shared marketing URL) got
      canonical + full OG + twitter card + theme-color + author.
    - **SEO-F8** sitemap.xml: added `<lastmod>` to every entry,
      added landing/reporters/shop, removed auth-gated
      study-room from the public index.
    - **SEO-F11** korehan-reporters, korehan-reporter, korehan-cards
      (all `lang="ko"` content pages) got SEO trio + OG card.
    - **SEO-F15** korehan-conversations.html: added `alt=` to the
      JS-injected thumbnail `<img>`.
  - **A11y finishing landed this PR**: 46 close-style `<button>`s
    across study-room / admin-CMS / mypage / learn / overview /
    conversations gained `aria-label="Close"`. 4 nav arrows got
    Back / Previous / Next labels. Phone-call play button +
    seekable progress-bar got their own labels.
  - **SEO follow-ups still open (P1, need owner JS or content work)**:
    - **SEO-F4** korehan-mypage / korehan-learning-overview have no
      meta description and no `<h1>` — minor but worth one pass.
    - **SEO-F5** dynamic OG for `?id=X` deep links (article /
      section / stories / conversations) — needs JS that updates
      `document.title` + og:* after fetching the content.
    - **SEO-F6** index.html / news / article / character / reporter
      have zero `<h1>` (hero `<div>` styled as headline). Demote one
      level or wrap in `<h1>`.
    - **SEO-F7** korehan-courses.html has 2× `<h1>` — demote one.
    - **SEO-F9** Add JSON-LD: `Organization` + `WebSite` on
      index/landing, `Article` on article pages, `Course` on
      courses, `LearningResource` on stories/conversations.
    - **SEO-F10** index.html title (78 chars) + description (240
      chars) exceed SERP truncation limits.
  - **Analytics audit (`add363bdb`, 16 findings) — OWNER ACTION**:
    - **AN-F1 (P0)** Plausible + Sentry are wired in
      `js/core/analytics.js` but `window.KH_PLAUSIBLE_DOMAIN` and
      `window.KH_SENTRY_DSN` are NEVER set in any HTML — both
      integrations no-op silently. **Set them once and traffic
      data starts flowing.** Probably want
      `window.KH_PLAUSIBLE_DOMAIN = "korehani.com"` injected via
      a tiny `<script>` block in every HTML, or via
      `korehan-shared.js` head injection.
    - **AN-F2 (P0)** `client_errors` has no notification path —
      critical errors sit silently until owner opens admin. Add
      `AFTER INSERT` trigger + `pg_net.http_post` to Discord, or
      a 5-min polling Edge Function. CLAUDE.md already noted this
      as outstanding from incident #526.
    - **AN-F3 (P0)** `client_errors` missing `severity` column —
      can't filter critical from noise. Migration:
      `ALTER TABLE client_errors ADD COLUMN severity text
      DEFAULT 'error' CHECK (severity IN ('debug','info','warn',
      'error','critical'));` + pass it from `kh_log_error()`.
    - **AN-F4 (P0)** Signup is untracked. Add
      `khTrack('signup_success',{method})` at shared.js:603 (OAuth)
      and shared.js:986 (email).
    - **AN-F5 (P0)** Payment funnel untracked (checkout_started /
      _failed / _succeeded). Stripe webhook errors only `console.error`,
      never persisted — broken webhook is invisible until users
      complain. Add `khTrack` + `client_errors` writes in
      `speaking-pass-webhook/index.ts`.
    - **AN-F6/F7/F8/F9 (P1)**: onboarding step funnel, quiz
      complete events, streak/coin events, speaking submission
      tracking — all missing.
    - **AN-F10 (P1)**: Plausible is gated behind `consent === 'all'`
      but Plausible is cookieless and doesn't need consent. Drop
      the gate or split it.
    - **AN-F11 (P2)**: PII risk — `user_quiz_results.details`
      stores raw transcript snippets. Redact or move.
    - **AN-F13 (P2)**: no Core Web Vitals telemetry.
    - **AN-F14 (P2)**: `navigator.doNotTrack === '1'` not honored.
    - **AN-F16**: `claude-proxy-index.ts` in `korehan/` is a static-
      bundled "reference" file — should be moved out of the public
      bundle.
  - **Sonnet → Haiku swap plan** delivered as
    `docs/sonnet-haiku-swap-plan.md`. 14 Sonnet sites mapped + 1
    Opus + 1 cron branch. Classification: **4 SWAP-SAFE**
    (phrase-bulk-pregen ×2, slang-bulk, phone-call-gen — ~$8–17/mo
    save, zero verify), **3 SWAP-RISKY** (ft-scenario branching
    graph, tutor screenshot OCR, fill-blank quiz — ~$9–18/mo
    if verify passes), **7 KEEP-SONNET** (article body, conv_gen,
    story_gen, bulk-seed siblings, admin-conv-sentence-analyze,
    sentence-reanalyze toggle, daily-content-gen Intermediate/
    Advanced — quality-critical user-facing content). User asked
    for suggestions only (no code change) — doc is the deliverable.

- **6차 오딧 — DB schema + RLS (2026-05-26)**:
  - Client-side fixes landed this PR:
    - **DB-F6** comments author fallback no longer uses
      `supaUser.email` (was leaking emails on every comment via the
      `comments.user_name` column). Falls back through user_metadata
      → localStorage display_name → email local-part → "User".
    - **DB-F15** `kh_log_error` strips `?query` and `#hash` from
      `location.href` before persisting to `client_errors.url`
      (OAuth flows pass tokens via query/hash; never log them).
  - **DB migration `20260526_audit_6_db_rls_hardening.sql`** —
    OWNER MUST APPLY via Supabase SQL editor or `supabase db push`.
    Covers DB-F1 (app_settings write-lock to user-scoped keys),
    DB-F2 (user_stats: revoke direct UPDATE on xp / coin_balance /
    etc.), DB-F3 (shop_items / gacha_items catalog write-lock),
    DB-F4 (payment_orders + shop_purchases server-only writes),
    DB-F5 (atomic `increment_article_view` RPC), DB-F6 (RLS
    WITH CHECK user_id = auth.uid()), DB-F10 (weekly_live_*
    own-row only), DB-F11 (client_errors user_id constraint),
    DB-F12 (weekly_live_sessions admin-create only), DB-F13
    (coin_transactions append-only), DB-F14 (column-level revoke
    on user_submissions.score / rubric / status).
  - **DB-F7 (P1) needs owner action OUTSIDE this PR**: the
    `award_xp(p_user_id, ...)` and `purchase_coin_shop_item(p_user_id, ...)`
    SECURITY DEFINER RPCs accept caller-supplied user_id. Their
    bodies live in production-only migrations (not checked in) so
    we can't patch them here — owner must edit and re-deploy so
    each function uses `auth.uid()` instead of the parameter
    (or raises if `p_user_id <> auth.uid()`).
  - **DB-F8 (FALSE POSITIVE)**: inspect_table_columns already
    has the admin-email gate inside the function body
    (`20260515_schema_inspect_rpc.sql`). Noted in the migration.
  - **DB-F9 (P1) needs schema-review with owner**: split
    `user_stats` into a public-readable view (display_name, xp,
    streak, articles_read) and a private table (email, prefs).
    Bigger than this PR's scope.

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

