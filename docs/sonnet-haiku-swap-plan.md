# Sonnet → Haiku swap recommendations (Audit #7 deliverable)

## Summary

Across the codebase there are **14 active Sonnet (`claude-sonnet-4-6`) call sites** plus **1 Opus (`claude-opus-4-6`) site** and **1 conditional Sonnet branch inside the cron Edge Function** (`daily-content-gen` for Intermediate/Advanced levels). All Sonnet sites except `daily-content-gen` and `sentence-reanalyze-sonnet` are admin-only bulk-generation paths in `korehan-x9f4k2m7.html` and `korehan-x9f4k2m7-phrases.html`. Rough total monthly Sonnet spend is in the **low $100s/mo**; a conservative full swap of the SWAP-SAFE column yields **~$30–55/mo saved** with negligible UX risk, while keeping the 4 KEEP-SONNET paths (article body, conversation gen, story gen, sentence-level admin re-analysis) preserves the public-facing quality bar.

## Per-site table

| # | Site (file:line) | feature key | Output | Volume | Recommendation | Risk | $/mo (rough) |
|---|---|---|---|---|---|---|---|
| 1 | `korehan/korehan-x9f4k2m7.html:3354` | `phrase-bulk-pregen` | Bulk-generate 20 Korean proverbs/idioms (rich JSON: ko, rom, en, intro_ko, intro, nuance, level, examples[], related[]) for the home-rail rotation queue | Admin one-shot, ~1–4×/week | **SWAP-SAFE [LANDED]** | low — schema is well-bounded, output is short multi-word phrases; the admin reviews each entry in a staging queue before Save All. Haiku already drives `admin-pregen-pm`/`-ke` which produce similar Korean-phrase JSON | ~$3–6 |
| 2 | `korehan/korehan-x9f4k2m7-phrases.html:378` | `phrase-bulk-pregen` (standalone copy) | Identical to #1 (the phrase-admin standalone HTML's local copy) | Admin one-shot, low frequency | **SWAP-SAFE [LANDED]** | low — same as #1 (this is the duplicated entry-point on the standalone phrase admin page) | ~$1–3 |
| 3 | `korehan/korehan-x9f4k2m7.html:5424` | `generate-article-body` | Public-facing Korean news article body (title, title_en, body with paragraph breaks) with prompt-caching breakpoint (PR #7AY: ~$70/mo cached savings already) | Cron: 100 articles/day | **KEEP-SONNET** | high — this is *the* public face of the site; AD-F10 already invested in caching here; the explicit owner rule (CLAUDE.md) is that body generation quality must stay top-tier. Stage 5-rule grammar audit also lives here (#7Z) | — (keep) |
| 4 | `korehan/korehan-x9f4k2m7.html:7235` | `sentence-reanalyze-sonnet` / `-haiku` (dual) | Per-sentence analysis (vocab, grammar, expressions) when admin clicks "Sonnet re-analyze" on a single sentence | Manual, ad-hoc per sentence | **KEEP-SONNET** | n/a — the admin already explicitly picks Sonnet vs Haiku here (`modelChoice` toggle). It is *intentionally* the higher-quality option for the rows where Haiku misfired. Leave as-is | — (keep as toggle) |
| 5 | `korehan/korehan-x9f4k2m7.html:9029` | `admin-conv-sentence-analyze` | Multi-rule per-line conversation analysis (vocab + register + analysis chunks). Prompt is the longest in the codebase — covers 호격, casual enders, 반말/존댓말, vowel contractions, conversational conjunctions, chat shorthand, news-marker exclusions, hard substring rules | Admin batch, on every conv post-save | **KEEP-SONNET** | high — multi-rule prompt with overlapping casual-Korean morphology rules + hard substring verification. Haiku has documented JSON malformed outputs on prompts this size (see `daily-content-gen` comments). The conv_analyze swap from a prior audit was a *different*, simpler conv-level feature | — (keep) |
| 6 | `korehan/korehan-x9f4k2m7.html:9504` | `conv_gen` | Full conversation generation including msgs[], vocab[], grammar[], key_expressions[], mission[]. Prompt embeds psych-verb / honorifics / counters / register rules and the essential-expressions weaving | Admin batch, several runs/week | **KEEP-SONNET** | high — public conversation lessons. The grammar rules in the prompt are explicit and dense; this is the conv counterpart of "article body" and is graded by the owner against the same UX bar. Note: `conv_analyze` was swapped (separate, simpler feature) | — (keep) |
| 7 | `korehan/korehan-x9f4k2m7.html:10071` | `story_gen` | Story body + vocab + grammar + comprehension; explicit psych-verb / counters / formality block in prompt | Admin batch, low volume (a few runs/week) | **KEEP-SONNET** | high — story body is user-facing reading content, same UX bar as articles + conversations. Long-form Korean prose where a wrong honorific or psych-verb stands out. Stage-2 analysis call here was already removed; this single call is the whole story | — (keep) |
| 8 | `korehan/korehan-x9f4k2m7.html:10537` | `bulk-seed-article-combined` | Article body + per-sentence analysis combined Sonnet call used by the bulk-seeder flow (single-shot 16K-token call) | Admin batch (bulk article seeding sessions, low frequency) | **KEEP-SONNET** | high — same content as #3 (article body) but the combined output also includes per-sentence analysis. Already the most schema-fragile path: `max_tokens` was bumped 8K→16K specifically because Haiku-shaped outputs were truncating | — (keep) |
| 9 | `korehan/korehan-x9f4k2m7.html:10986` | `bulk-seed-conv` | Same as #6 but single conversation per call inside a bulk loop | Admin batch (bulk seed sessions) | **KEEP-SONNET** | high — same UX surface and grammar rules as #6 | — (keep) |
| 10 | `korehan/korehan-x9f4k2m7.html:11249` | `bulk-seed-story` | Same as #7 but single story per call inside a bulk loop | Admin batch (bulk seed sessions) | **KEEP-SONNET** | high — same UX surface as #7 | — (keep) |
| 11 | `korehan/korehan-x9f4k2m7.html:12303` | `slang-bulk-generate` | Bulk slang/신조어 entries (ko, en, desc_text, tag, warn, difficulty, chat[]). Output is short and well-structured | Admin one-shot, very low frequency | **SWAP-SAFE [LANDED]** | low — short outputs, simple JSON, chat snippets are 4 messages. Haiku already powers the phone-call-style admin paths. Worth A/B-checking that Haiku doesn't over-pad warn flags | ~$2–4 |
| 12 | `korehan/korehan-x9f4k2m7.html:12476` | `phone-call-generate` | Bulk Korean phone-call scripts (3 per run) with timed script[] entries (speaker, start/end, ko, en) | Admin one-shot, very low frequency | **SWAP-SAFE [LANDED]** | low — short structured output (6–10 lines per script, timestamps). The casual-vs-formal register is the only watch-out (see verify checklist). Phone calls are also a relatively low-stakes feature compared to articles/stories | ~$2–4 |
| 13 | `korehan/korehan-x9f4k2m7.html:20074` | `ft-scenario-gen-admin` | Branching dialogue scenarios for the "Fast Track" feature (≥25 nodes per scenario, NPC text + 2-4 choices per node, point values) | Admin one-shot per scenario | **SWAP-RISKY** | medium — large nested JSON with branching graph (nodes + edges) plus per-choice metadata. Haiku failure mode here would be malformed branching graphs (orphan nodes, dead-end choices). Verify on 5 scenarios before flipping | ~$3–6 |
| 14 | `korehan/korehan-tutor-7v3ca.html:2333` | `tutor-import-lessons` / `tutor-import-students` | Multimodal (screenshot → structured JSON) import for the tutor side — extracts lessons/students from uploaded screenshots | Tutor admin manual flow, very low frequency | **SWAP-RISKY** | medium — multimodal vision call. Haiku 4.5 vision quality on Korean screenshots is generally OK but OCR misreads on Hangul are the failure mode. Verify on a fixed set of 10 screenshots before flipping. Low volume = low savings even if swapped | ~$1–2 |
| 15 | `korehan/js/features/fill-blank.js:303` | `quiz` | User-facing fill-in-the-blank questions generated per article on demand (6 questions, 4 choices each) | **Per-user, per-article**, on-demand (cached after first call in `article_cache`) | **SWAP-RISKY** | medium — user-facing learning content with grammar-point labels (e.g. `-아/어서`, `은/는 topic marker`) inside `grammar_point`. Wrong grammar labels would be visible to learners. BUT: results are cached per article so volume is amortised; failure mode is bounded (6 short outputs). Verify on a 20-article sample (esp. Intermediate + Advanced) before flipping | ~$5–10 |
| 16 | `supabase/functions/daily-content-gen/index.ts:103` | (Edge Function — no `feature` key, direct fetch) — Sonnet branch | Daily-content generation for `study_daily_content` rows. Sonnet is used for Intermediate / Advanced only; Starter / Beginner already on Haiku. Includes `confusing_grammar`, `formality_exercise`, `culture_note` schemas | Cron: 2 levels × 2 days = **4 Sonnet calls/day** | **KEEP-SONNET** | high — the explanatory comment in the file says Haiku 4.5 returned malformed JSON ~50% of the time on these complex schemas, so this is already an *informed* keep. Re-evaluate only after Haiku 4.6+ ships or after schema simplification | — (keep; revisit if model updates) |
| 17 | `korehan/korehan-x9f4k2m7.html:17703` | `grammar-pdf-parse` | One-off Opus call to parse a Korean grammar PDF into structured patterns | Admin manual, **one-time** (PDF ingestion) | **KEEP-OPUS or downgrade to SONNET** | n/a — Opus is overkill; Sonnet would be cheap and sufficient. But the run-frequency is effectively zero ($/mo ≈ 0), so not worth changing | — |

### Totals

- **SWAP-SAFE sites**: 4 (#1, #2, #11, #12) → estimated **~$8–17/mo** savings.
- **SWAP-RISKY sites**: 3 (#13, #14, #15) → estimated **~$9–18/mo** savings *if* the verify pass goes clean.
- **KEEP-SONNET**: 7 sites + 1 Edge-Function branch — these are the public-facing article/conv/story bodies and the multi-rule analysis prompts.
- **KEEP-OPUS**: 1 site (effectively zero monthly cost).

Net: a safe-pass swap nets roughly **$10–20/mo** ; a full pass (including the verified RISKY column) nets **$20–40/mo**. Compare with the ~$70/mo already saved by AD-F10's prompt caching on article body, and the low-$100s/mo total bill — Audit #7 is a 10–25% incremental reduction, not a game-changer, but a clean, easy one for the SAFE column.

## Verify-before-swap checklist

For each SWAP-RISKY site:

1. **Fixed-prompt A/B harness.** Pick 20 representative prompts (real prior inputs pulled from `claude_api_usage` table or admin logs). Run BOTH `claude-sonnet-4-6` and `claude-haiku-4-5-20251001` against each prompt. Persist both outputs side-by-side in a temp table or local JSON.
2. **Spot-check by a native or fluent Korean reader** (or the owner) — at minimum:
   - Korean grammar correctness (psych-verb 1st/3rd, honorifics, particles, formality consistency, tense agreement, spacing).
   - Schema validity: every required JSON field present, types match, arrays the right length.
   - For #13 (`ft-scenario-gen-admin`): walk the branching graph — every `next` references a real node, no orphans, end node reachable from start.
   - For #14 (`tutor-import-*`): OCR character accuracy on Hangul — does Haiku misread ㅓ/ㅔ, ㅡ/ㅢ, etc?
   - For #15 (`fill-blank.quiz`): `grammar_point` labels match the established taxonomy (`~아/어서`, etc.), not invented variants.
3. **Output-shape regression**: parse-success rate over the 20 prompts. Haiku must be ≥95% on first parse (the conv-analyze swap was greenlit on the same bar).
4. **Cost confirmation**: pull `priceUsd()` from `claude-proxy/index.ts` (or just run the existing `claude_api_usage` aggregation queries) on the 20-prompt sample and confirm the per-call savings are in the expected ~7× range. If Haiku spends more tokens compensating for the harder prompt, the savings shrink.
5. **Shadow mode for 1 week** (optional, for #15 only — it's the user-facing one): keep the Sonnet call as the primary, fire a parallel Haiku call, log both into a `quiz_shadow_compare` table, and have the owner manually grade differences each evening. Flip only after a 7-day clean run.
6. **Single rollback knob**: when flipping, edit only the one `model:` string per site so any regression is a single 1-line revert + a cache-buster bump per the PR #526 "always bump `?v=` after a JS change" rule.

## Order of operations

1. **Phase A — SWAP-SAFE (immediate, no verify needed):** Swap #1, #2, #11, #12 in one PR. Keep the cache-buster discipline (bump every script that changed). Total ~$8–17/mo, ~10 min of work.
2. **Phase B — Build the verify harness.** Add a small admin-only "Sonnet vs Haiku" comparator screen to `korehan-x9f4k2m7.html` that takes a `feature` key + N saved prompts and runs both models side-by-side. This is a reusable tool for *all* future model audits, not just this one.
3. **Phase C — SWAP-RISKY pass.** Run the harness on the 20-prompt sample for each of #13, #14, #15 in that order. Flip whichever pass the bar; keep the rest on Sonnet. Document the result in `TODO.md` under a new `AD-F12` or similar entry.
4. **Phase D — Re-evaluate KEEP-SONNET sites yearly.** Schedule a re-audit when Haiku ships a new major version (Haiku 4.6+) or when Anthropic publishes structured-output / JSON-mode improvements. The `daily-content-gen` comment already documents the failure mode that gates this; re-run the same test prompts at that point to confirm or release the lock.
5. **Phase E (deferred / parallel track) — Opus → Sonnet downgrade on #17** (`grammar-pdf-parse`). Trivial swap, but volume is zero, so prioritize only if you happen to be in that file for unrelated reasons.

---

### Notes / one-line caveats

- Estimates are **rough**: actual $/mo depends on input-token volume per call, which varies a lot (e.g. `bulk-seed-*` runs with rich prompts vs `tutor-import-*` runs with image tokens). The owner can sharpen these with a `select feature, model, sum(input_tokens), sum(output_tokens) from claude_api_usage group by 1,2 order by 3 desc` query on the live table.
- `conv_analyze`, `vocab-sanity-check`, and `admin_retrigger_feedback` (the 3 already-swapped sites) are **not** in this table — they already ship on Haiku and confirm the SWAP-SAFE classification for admin-side schema-tight bulk paths.
- The KEEP-SONNET justification for #5–#10 leans heavily on the owner's own past notes: "writing-feedback `corrected_full`" is explicitly cited as the worst-UX-miss case, and the article body has $70/mo of prompt-caching investment behind it. Treat #3 / #6 / #7 as in the same protection class.

---

## Status

**Phase A landed 2026-05-26 on branch `claude/sonnet-to-haiku-phase-a`.**
- Sites #1, #2, #11, #12 swapped from `claude-sonnet-4-6` → `claude-haiku-4-5-20251001`.
- Expected savings: ~$8–17/mo (admin-only bulk paths, low frequency).
- 9 Sonnet call sites remain (the 7 KEEP-SONNET production paths + #4 admin sentence-reanalyze toggle + #13 RISKY ft-scenario-gen pending verify).

**Phase B/C (SWAP-RISKY: sites #13, #14, #15)** — not yet executed. Needs the A/B comparator harness described in the Verify-before-swap checklist.
