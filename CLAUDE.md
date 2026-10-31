<!-- sync marker -->
# CLAUDE.md — KoreHan News: AI Assistant Guide

## Project Overview

KoreHan News is a **Korean language learning platform** delivered as a static web application. Users read real Korean news articles, stories, and conversations at different TOPIK levels, and the platform tracks vocabulary, grammar, reading, and quiz progress across five learning axes.

**Live infrastructure:**
- Frontend: Static HTML/CSS/JS files hosted on **Cloudflare Pages** (deploys from `main`)
- Database & Auth: **Supabase** (PostgreSQL + Edge Functions)
- AI: **Anthropic Claude API** (proxied through Supabase Edge Function — never exposed to client)

---

## Repository Structure

```
korehan-news/
├── korehan/                        # All frontend files (served as-is)
│   ├── index.html                  # Home/dashboard
│   ├── korehan-x9f4k2m7.html       # Admin CMS (obscured URL — content management)
│   ├── korehan-study-room.html     # Main learning interface
│   ├── korehan-mypage.html         # User profile & progress
│   ├── korehan-learning-overview.html  # Learning hub dashboard
│   ├── korehan-conversations.html  # Conversation lessons
│   ├── korehan-stories.html        # Story lessons
│   ├── korehan-learn.html          # Flashcard/vocabulary learning
│   ├── korehan-courses.html        # Course catalog
│   ├── korehan-onboarding.html     # New user onboarding
│   ├── korehan-*.html              # Section/navigation pages (article, culture, etc.)
│   ├── korehan-shared.js           # CORE: Supabase client, auth, Claude proxy, utilities
│   ├── korehan-shared.css          # CORE: Global theme, CSS variables, components
│   ├── korehan-hover-tooltips.js   # Hover vocabulary tooltip system
│   └── _headers                    # HTTP header configuration (Cloudflare Pages)
├── docs/reference/                 # Internal docs moved out of the web root (never deploy docs from korehan/)
└── supabase/
    └── functions/
        └── claude-proxy/
            └── index.ts            # Supabase Edge Function (Deno runtime)
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML5, JavaScript (ES6), CSS3 — **no framework** |
| Fonts | Google Fonts: Happy Monkey (English), Jua (Korean), Noto Serif KR, Noto Sans KR, Playfair Display, DM Sans, Source Sans 3 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth 2.0 |
| Edge Functions | Deno (TypeScript) via Supabase |
| AI | Anthropic Claude (via Edge Function proxy) |
| Hosting | Cloudflare Pages (static file serving) |
| Package manager | None — no build step required |

---

## Build & Deployment

**There is no build process.** Files in `korehan/` are deployed directly to Cloudflare Pages as static assets.

- Changes to HTML/JS/CSS are effective immediately on deploy
- No `npm install`, no transpilation, no bundling
- Deploy by merging to `main` (Cloudflare Pages auto-deploys)
- The `_headers` file controls HTTP caching and security headers

**Supabase Edge Functions** (in `supabase/functions/`) are deployed separately:
```bash
supabase functions deploy claude-proxy
```

---

## Core Files — What They Do

### `korehan/korehan-shared.js`
The most important file. Included by every page. Provides:
- `getSupa()` — lazy-initialized Supabase client (use this everywhere)
- `callClaude({ feature, model, max_tokens, messages })` — Claude API proxy caller
- Auth helpers: login, logout, session management
- Shared UI utilities

**Pattern for Supabase client:**
```javascript
var _supa = null;
function getSupa() {
  if (!_supa && window.supabase) {
    _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true } });
  }
  return _supa;
}
```

### Learning Hub calls
There is no `learning_hub_client.js` (removed). Call RPCs / tables directly with `getSupa()`:
`log_read_event`, `save_or_update_word`, `log_quiz_result` RPCs; `logActivity` / `logQuizResult` /
`dbSaveWord` helpers live in `korehan-shared.js` / `js/core/saved-words.js`. Saved words live in
**`user_saved_words`** (with `srs_*` columns) — `saved_words` is dead.

### `supabase/functions/claude-proxy/index.ts`
Deno Edge Function that:
1. Verifies JWT for regular users (or `x-admin-bypass` header for admin)
2. Fetches the Anthropic API key from `app_settings` table (never hardcoded)
3. Forwards the request to Claude API
4. Returns the response

**Accepted request body:**
```json
{
  "feature": "string (e.g. 'vocab-analysis')",
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 2000,
  "messages": [{ "role": "user", "content": "..." }]
}
```

---

## Database Schema (Supabase)

### Content Tables
| Table | Purpose |
|-------|---------|
| `articles_data` | News articles (title, body, section, TOPIK level, image, status) |
| `conversations_data` | Real Korean conversations with metadata |
| `stories_data` | Story lessons with mood categories |
| `cast_characters` | Fixed 20-person cast for conversations. Identity = name + age_band + gender + image only. Occupation / relationship / personality colour are set per-conversation by the AI prompt. Avatars live in the `character-avatars` Storage bucket. |
| `role_characters` | Pool of role-based NPCs (의사, 경찰, 선생님, 점원, …) that recur across conversations. First conv that needs the role creates the entry; later convs reuse it from DB so learners recognise the same face. Shares the `character-avatars` Storage bucket. |
| `character_reporters` | Reporter cast — reserved for stories / news / webnovel. Do NOT mix into conversation casting. |
| `essential_expressions` | High-value Korean phrases / idioms / formulas (multi-word). Woven into generated conversations by the conv-gen prompt so learners encounter the same expressions naturally across many scenes. |
| `vocabulary_bank` | Master vocabulary pool for daily assignments |
| `hover_vocab_master` | Hover definitions (word → definition mapping) |
| `article_cache` | Cached AI analysis (vocab, grammar, mission per article) |
| `app_settings` | Configuration including `anthropic_key` |

### Learning Hub Tables
| Table | Purpose |
|-------|---------|
| `user_read_history` | Per-user reading activity |
| `user_saved_words` | Per-user vocabulary saves |
| `user_daily_progress` | Daily stats aggregated per user |
| `user_quiz_results` | Grammar and vocabulary quiz attempts |

### Key RPC Functions
```sql
log_read_event(p_content_type, p_content_id, ...)
save_or_update_word(...)
log_quiz_result(...)
get_learning_hub_snapshot()   -- returns weekly analytics for current user
assign_daily_vocab()          -- assigns 20 words from vocabulary_bank
```

### Learning Progress Axes
The platform tracks five score axes:
1. **Reading** — articles/stories/conversations read
2. **Vocabulary** — words saved and reviewed
3. **Grammar** — grammar quiz performance
4. **Writing** — (planned)
5. **Listening** — (planned)

---

## Code Conventions

### JavaScript
- **Vanilla ES6** — no frameworks, no TypeScript on the frontend
- Prefer `var` for module-level state (legacy pattern in this codebase); `const`/`let` in functions
- DOM initialization in `DOMContentLoaded` listener
- Always use `getSupa()` (never create a new Supabase client directly)
- Never call Claude API directly — always use `callClaude()` from `korehan-shared.js`
- Never hardcode API keys anywhere in frontend code

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  const sb = getSupa();
  const { data, error } = await sb.from('articles_data').select('*');
  // ...
});
```

- **No emojis in the UI** (owner rule, 2026-10). Use Lucide icons: `khIcon('name')` / `<i data-lucide="name">` in markup (any injected `<i data-lucide>` is drawn automatically), `khSvg()` for inline SVG. `js/core/emoji-icons.js` (loaded on every page) converts any emoji that still reaches the DOM — including DB text — into the mapped icon and strips emojis from title/placeholder/option text, but don't add new emoji literals; native `alert()`/`confirm()` text is not converted.

### CSS
- CSS custom properties (variables) defined in `:root` in `korehan-shared.css`
- Color palette: `--navy`, `--accent`, `--bright`, `--sky`, and related vars
- Component prefix: `.kh-` for KoreHan-specific components
- Dynamic content IDs: `dyn-*`
- Static component IDs: `kh-*`
- Responsive: mobile-first, max-width 1280px container
- Transitions: `.15s`, `.18s`, `.2s` (keep short)

### HTML Pages
- Every page includes `korehan-shared.js` and `korehan-shared.css`
- Load Supabase from CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Self-contained pages: logic and styles often inline in the HTML for the largest pages

### File Naming
- Pages: `korehan-[section].html`
- Shared utilities: `korehan-[feature].js` / `korehan-[feature].css`

---

## Security Rules

1. **Never expose the Anthropic API key** to the browser. Always proxy through `supabase/functions/claude-proxy/index.ts`
2. **Never expose the Supabase service role key** to the browser. Use only the anon key (already in `korehan-shared.js`)
3. The anon key + RLS (Row Level Security) on Supabase tables is the auth model
4. Admin pages use `x-admin-bypass` header with the service role key — this header is only sent server-side or in the admin panel which requires login
5. The `_headers` file sets security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` blocking camera/geolocation and allowing the microphone for same-origin only (`microphone=(self)` — Speaking/pronunciation recording needs it; `microphone=()` silently broke recording site-wide)

---

## Testing

**There is no automated test suite.** Manual testing is currently the only verification method.

When making changes:
- Test in browser for HTML/JS/CSS changes
- Test the Edge Function with `supabase functions serve claude-proxy` locally
- Verify Supabase RPC changes by calling them from the browser console or Supabase SQL editor

---

## Common Tasks

### Adding a new page
1. Create `korehan/korehan-[name].html`
2. Include `korehan-shared.css` and `korehan-shared.js` at the top
3. Load Supabase JS from CDN before `korehan-shared.js`
4. Initialize logic inside `DOMContentLoaded`

### Adding a new database query
```javascript
const sb = getSupa();
const { data, error } = await sb.from('table_name').select('col1, col2').eq('field', value);
if (error) { console.error(error); return; }
// use data
```

### Calling Claude from a page
```javascript
const result = await callClaude({
  feature: 'my-feature-name',
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Your prompt here' }]
});
```

### Updating the Edge Function
Edit `supabase/functions/claude-proxy/index.ts`, then:
```bash
supabase functions deploy claude-proxy
```

### Adding a Learning Hub RPC call
1. Add the function in an idempotent `supabase/migrations/*.sql` file starting with `-- auto-apply`
2. Call it from the page with `getSupa().rpc(...)` and `await` it (see the pitfall below)

---

## Git Workflow

- **Production branch: `main`** — Cloudflare Pages deploys from `main`. Always merge to `main`, never `master`.
- Feature branches: `claude/[description]-[id]` for AI-assisted changes
- Workflow: feature branch → PR → merge to `main` → Cloudflare auto-deploys
- `master` branch is deprecated — do not push to it
- Commit messages should be descriptive and imperative: `Fix vocab quiz button: use tab=vocab`
- CI: `apply-migrations.yml` (auto-apply SQL), `deploy-edge-function.yml`, `db-report.yml` (read-only `supabase/reports/*.sql`), syntax check

---

## Known Patterns & Gotchas

- **Large HTML files**: `korehan-admin.html` (207KB) and `korehan-study-room.html` (141KB) contain significant inline JS and CSS. When editing, be precise about which section you are modifying.
- **No build step**: Any linting or formatting must be done manually — there are no pre-commit hooks.
- **Caching disabled**: `_headers` sets `Cache-Control: no-cache` for all assets. This is intentional to ensure users always get fresh content.
- **Daily vocab assignment**: `assign_daily_vocab()` pulls 20 words from `vocabulary_bank` and deduplicates across days. The cache logic in the frontend deduplicates within a day using a timestamp check.
- **Article cache**: `article_cache` stores AI-generated vocab/grammar/mission per article. If fewer than 5 vocabulary items exist in the cache for an article, the cache is considered stale and regenerated.
- **Timezone handling**: Daily progress calculations use the user's local timezone — ensure date comparisons account for this.

---

## Rules learned the hard way (2026-10-12 launch audit)

- **A Supabase query only sends when awaited / `.then()`-ed.** `sb.rpc(...).catch(fn)` throws (no
  `.catch` on the builder) and a bare `sb.from(...).insert(...)` statement never runs. Always
  `await` or `.then(onOk, onErr)`.
- **RLS:** client-readable `app_settings` keys are an explicit allow-list
  (`20261012_app_settings_lockdown.sql`) — secrets (API keys, Stripe, Zoom) must never be added to
  it. Per-user tables are owner-only; content tables are admin-write
  (`20261012_rls_lockdown.sql`). New tables need RLS + owner policies from day one.
- **Explicit column lists must match the live schema** (`LIST_ARTICLE_SELECT`); verify against
  production before adding a column name.
- **Writing-flow frame packs** (`20261026_writing_topic_content.sql`, built from a script): every
  option in every frame must work with every option in every OTHER frame (no "아침" + "일이 끝나서",
  no "칼국수집" + "파스타"). Enumerate all combinations before shipping a pack. AI corrections are
  filtered through `khRealCorrections()` — NUANCE / "is natural" items are never shown as mistakes.
- **Sentence-order answers** go through `khOrderIsCorrect(orig, sel, acceptable_orders)`
  (korehan-shared.js): the sentence as written + its hand-written `acceptable_orders` list. No list =
  only the original. Never add a "natural reordering" heuristic back — it accepted
  "음악을 보통 들으면서 쉬어요". To accept another order, add it to the content's list.
- **Quiz distractors must be wrong in the slot**, not just different words (`khWordClass`,
  `khSameMeaning` in korehan-study-room.js).
- **Every AI-made thing learners see must pass the content-qa reviewer.** Awkward examples and odd
  meanings came from content that skipped it (article analysis, shared AI caches, word bank — written
  by the browser, admin tools and crons). Tables in the review queue carry `qa_at` + the
  `kh_requeue_on_content_change` trigger (`20261028_content_review_queue.sql`); content-qa step 6
  reviews rows with `qa_at is null` (`content-qa/queue.ts`). A new table/cache of AI content must get
  the column, the trigger and a job in step 6 — never ship one that bypasses review. Romanization is
  cross-checked against `_shared/romanize.ts` (rule-based RR); don't trust AI/PDF romanizations.
- **Shared AI caches are server-write only** (`20261028_cache_write_server_only.sql`). Readers save
  `article_cache` slots / `grammar_examples_cache` keys through `khCacheWrite()` → the `cache-write`
  Edge Function (fill-only, shape-checked, 120 saves/hour/user, stamps `written_by`).
  `article_study_content` is admin-generated only. Never give readers direct write access to a
  shared table again — add a slot to `cache-write` instead.
- **Word Bank** (`korehan-learn.html` + `js/features/word-bank.js`) reads the `word_bank` view
  (vocabulary_bank + word_tags). ~6k words, meanings and examples come from 한국어기초사전
  (NIKL, CC BY-SA 2.0 KR, `source='krdict'`, imported by `.github/workflows/word-bank-data.yml`).
  Keep the attribution line on the page; drills are built from the bank — no AI calls.
- **Life in Korea** (`korehan-life.html`, `js/features/life-guides.js`): guides live in `life_guides`, written in
  `scripts/life-guides/guides.mjs` → `build.ts` → seed migration. Every guide shows a last-checked date and
  official sources; re-check facts (fees, hours, wages) before changing `CHECKED`.
- **TOPIK Practice** (`korehan-topik.html`, `js/features/topik.js`): ORIGINAL questions only (never copy past
  papers — NIIED copyright). Written in `scripts/topik/items.mjs` (`a` = the one right answer, `w` = three
  wrong-in-slot distractors) → `build.ts` shuffles and writes the seed. Free tests are open; other tests' items
  are Premium-only via RLS. Branded "TOPIK-style … not affiliated with NIIED".
  Every question is reviewed before learners see it (`scripts/topik/REVIEW.md`): `lint.ts` blocks the build,
  an independent reviewer reads every item, and new tests seed as drafts that the admin approves in the app.
  New tests set `balance: true`; never reshuffle an existing test (saved attempts store choice positions).
- **Live class** is part of **Premium Live** ($27.99/mo, monthly only — owner 2026-10-29): Premium ($8.99/mo,
  $69/yr) has no live class; Premium Live = Premium + one included seat a week (8 seats, book/cancel until booking
  closes 1 h before, no rollover, no recording). Plan value `premium_live` (from the Stripe price lookup_key
  `kh_premium_live_month` in billing-webhook); `kh_is_premium` counts it, `kh_has_live` gates seats; front end
  uses `khIsPremiumPlan()` / `khHasLive()` — never compare `getUserPlan() === 'premium'`. Seats are written only
  by `billing` (`live_reserve` → atomic `kh_live_reserve_seat`, status 'comp'; `live_cancel`) — never from the
  client. Legacy $5 'paid' seats still refund through `live_cancel`.
- **My Room**: `user_room_state.owned` is server-only — only `buy_room_item`, `kh_claim_room_unlocks` (both security
  definer) or service_role write it (column grants + `kh_room_state_guard_owned` trigger,
  `20261029_my_room_ownership_prices.sql`); the client saves only `layout` / `prefs`. Study unlocks
  (`room_unlocks`, `20261029_room_learning.sql`): the claim RPC computes progress on the server (streak + games from
  the server-written `coin_transactions` ledger, saved words, real articles read, TOPIK tests) and only ever adds
  items; unlock items can't be bought (`UNLOCK_ONLY`). Other people's rooms are read only through
  `get_public_room` (room fields only); likes are `room_likes` (own-row RLS) + `get_room_likes` / `toggle_room_like`. Prices are tuned to the nyang earn rate (~50/day regular study) — see that
  migration's comment before changing them. No particle effects in the room, pets don't wander. Only exception (owner
  2026-10-31): the theme pictures' own windows (`FX` in avatar-art.js: city lights, tower beacon, snow inside the panes).
- **My Room character + room themes** (`js/features/avatar-art.js` drawing/catalogue, `avatar-editor.js` = My Room →
  Customize): outfits / accessories / theme pictures live in `avatar_items` (ids `av_outfit_*`, `av_acc_*`,
  `av_room_*`, `20261030_avatar_catalog.sql`), bought only through `buy_room_item` (refuses unlock-only items and
  out-of-season ones), study unlocks granted by `kh_claim_room_unlocks`, ownership in the same server-only
  `owned` list. What's worn is client prefs (`prefs.avatar`, `prefs.rooms[].theme`) + layout entry `kh_avatar`;
  `get_public_room` drops worn items the owner doesn't own. Streak for unlocks = `kh_user_streak`. No placed-on
  hats (owner rule). New sprite/theme art: bump `KH_ROOM_ART_V`. Skin tone (`prefs.avatar.skin`, free:
  light/tan/brown/deep) tints the sprite through a per-sprite mask (`assets/avatar/skin/<sprite>.png`,
  `scripts/avatar/skin-masks.py`) — re-run it for every new or redrawn sprite. My Page room: look mode shows only the
  room + Edit; tools (My items / Character / Theme / Shop, room tabs, item toolbar) appear in edit mode, which also
  hides the bottom tab bar. No Daily Mission pill on My Page. My items = inline panel under the room (room-tabs.js
  tray, category chips), not a pop-up. Drawn item size = `khRoomItemSize(base_size, category)` (characters keep the old
  doubling; everything else 0.85 x base_size).
- **Several rooms** (`js/features/room-tabs.js`, `20261030_room_slots.sql`): `prefs.rooms` = tab order (rooms[0]
  id `main` = everyone's original room); all rooms share the one `layout` array and an entry's `room` field says
  where it stands (none = room 1), so an item is in one room at a time. My Page's `getRoomLayout`/`setRoomLayout`
  are the current room's view; sync with `_getRoomLayoutAll()`. Extra rooms = slots `room_slot_2..5` bought via
  `buy_room_item` (2nd 600 / Premium included, 3rd 1,000, 4th-5th 1,500 Premium only); the count is
  `kh_room_allowed()` on the server. Rooms past it (Premium lapsed) are hidden, never deleted; `get_public_room`
  returns only allowed rooms. `buy_room_item` + `get_public_room` live in `20261030_room_slots.sql` only.
- **Admin = unlimited nyang** (owner 2026-10-31): `buy_room_item` and `purchase_coin_shop_item`
  (`20261031_admin_unlimited_nyang.sql`) charge `is_admin_email()` 0 and skip unlock-only / season / Premium / slot-order
  checks; the client only mirrors it for display (`khNyangUnlimited()`, balance shows ∞). Never trust the client flag.
- **Reporters are an idol-style IP** (owner 2026-10-31; `character_reporters.data`, lineup in
  `20261031_reporter_lineup.sql`): photocards / goods are sold per reporter, so a reporter name must never match a
  real celebrity (정우성/한소희/김지원/박서진 were renamed) — check before adding one. No politics beat. Each section has
  one reporter (`SECTION_REPORTER_MAP` in the admin + the migration's map); profile fields: age, birthday (MM-DD), mbti,
  symbol, catchphrase, likes (+ `_en`). 오관식 keeps his cigar (owner). Physical goods are "Coming soon" — digital only.
- **Reporter page = Instagram style** (owner mockup 2026-10-31; `korehan-reporter.html` markup/CSS +
  `js/features/reporter-page.js`, `20261031_reporter_feed.sql`): posts are admin-write only (RLS was open to any
  signed-in user before); a post carries `caption_en`, `vocab` [{ko,en}] (tappable words → My Words) and `quiz`
  {q,a,w[]}. Follows / likes are own-row tables, counts via `kh_reporter_feed_stats()`. Comments reuse `comments`
  with `article_id = 'rpost:<post id>'` through `submit_comment` (cooldown) and must contain Hangul. QA:
  `scripts/qa/reporter-page.mjs` (network mocked). The page's shared light-theme colour overrides are pinned at the top
  of its CSS (b / h2 / [lang=ko]).
- **Special shop** (card payments for digital items, owner 2026-10-31; `20261031_cash_shop.sql`, shop tab `special` in
  shop-client.js): products in `cash_products` (inactive until their art lands), billing `item_checkout` → Stripe
  (mode payment, Premium gets `premium_discount_pct`) → billing-webhook `kh_grant_cash_order` (items into
  `user_room_state.owned`, `pc_*` ids into `user_photocards`); a full refund runs `kh_revoke_cash_order`. Cash art is
  `cash_only` on room_items / avatar_items — buy_room_item refuses it for nyang, the nyang shop / My Room / Customize
  hide it or show "Special". Never sell nyang for cash, no paid random boxes; real goods stay "Coming soon"
  (`goods_interest`). QA: `scripts/qa/special-shop.mjs` (all network mocked).
  Card items are price 0 in nyang: every "price 0 = free starter" rule must also check `cash` / `cash_only`
  (`_roomFreeIds`, room-view, `isFree`, `kh_avatar_item_ok`, get_public_room) — or everyone owns them.
  Products start inactive; the admin sees them as DRAFT in the Special tab. Art round 1:
  `20261031_special_shop_art_1.sql`.
  Reporter photocards: a `photocard_set` product lists card ids `pc_<reporter>_s<set>_NN` in `items` and the
  matching pictures in `preview` (same order; art in `assets/photocards/<reporter>/`, 768x1152 webp from the
  owner's 1024x1536 originals). The reporter page Cards tab is the card book: owned cards (`user_photocards`,
  server-written) open big, the rest are locked and link to the Special shop. Photocards must be face-forward
  (close-up / chest-up / selfie): full-body art is for acrylic stands and posters, not cards.
- **Animated room pieces** (owner 2026-10-31, the second exception to "nothing moves"): `KH_ROOM_FRAMES`
  (room item id → `assets/room/<name>-1..n.png`, e.g. the Christmas fireplace's fire, only the flames differ) and
  outfits with `frames` (idol: `<hair>-idol-1..8` dance poses, eyes kept on the centre line, `ANIM_MS` each).
  `khRoomAnim(el, urls, ms)` (korehan-shared.js) swaps them; off with prefers-reduced-motion, paused in hidden tabs.
  New pose frames need SPRITE metrics, the hair-halo fix and skin masks like any sprite.
  New outfit pictures also get `scripts/avatar/defringe.py` (white background fringe on the hair's outer edge).
  and `scripts/avatar/hair-gaps.py` (white gaps enclosed BETWEEN long-hair strands beside the arms), then skin-masks.py.
  Swapped frame areas must leave out anything in front of the moving part (the fireplace grate stays frame 1).
  Admin test grants: `kh_admin_grant_product` / `kh_admin_reset_product` (`20261031_admin_grant_product.sql`,
  amount 0 orders) behind the "Admin test" row in the Special sheet.
- **Fake News** (ON HOLD since 2026-10-29: `KH_FAKE_NEWS_ON = false`, articles are drafts) (section key `fake`, `khIsFakeNews()` / `khFakeTag()` / `khFakeBanner()` in korehan-shared.js):
  openly made-up joke stories about real famous people, owner rule. Only harmless, flattering absurdity —
  no crime, romance, health, death, politics or politicians, nobody in an active controversy; illustrations
  show props, never faces. Never in real-news lists (`published()` with no section, home News grid/hero,
  next-article feed) — only the home Fake News rail and `korehan-section.html?s=fake`; every card carries
  the yellow FAKE NEWS tag, every article the banner, shares get a "[Fake News]" prefix.
- **Room / avatar art URLs carry a version** (`khRoomImg()` + `KH_ROOM_ART_V` in korehan-shared.js). `/assets/*`
  is cached for a year and a missing file returns the HTML fallback with 200, so a picture requested before it
  was uploaded stays broken on that device. Bump `KH_ROOM_ART_V` (and shared.js `?v=`) whenever art is added.
  The props catalogue migration (`20261029_room_props.sql`, written by `scripts/room-art/catalog.py`) ships
  together with its art.
  Shop chips come from `room_items.shop_category` (`20261031_room_items_shop_category.sql`); new art → set its
  category in the same PR (no category = All only).
- **Production wraps every .js file in its own scope** (`vite build` on Cloudflare Pages → `isolateMinifiedBundle`
  in vite.config.js; top-level names are re-exported onto window). So a later file's `function foo` does NOT
  replace calls to `foo` made inside an earlier file that also declares it — raw local serving hides this (My
  Words drew the old Word Book list, 2026-10-30). To override a function, delete the old declaration. Run the
  click-through QA (`scripts/qa/*.mjs`) against `node scripts/qa/prodlike.mjs` output, not raw `korehan/`.
- **Large Korean-text migrations can arrive with broken characters (U+FFFD).** The Supabase query API
  mangled multi-byte characters in big payloads (2026-10-30/31: article_cache, grammar_examples_cache),
  even with `jq -Rsa` escapes. For big seeds / repairs send the text as base64 and let Postgres decode
  it (`convert_from(decode('<b64>', 'base64'), 'UTF8')`, see `20261031_fix_broken_chars_article_cache_b64.sql`),
  and scan the table for U+FFFD after it applies.
- **Streak = `kh_user_streak` (KST days with a `daily_missions` row) on every screen and device.** This device's
  own study log (`getCurrentStreak`) is only a guess until the server answers; `khStreakNow()` asks the server
  and `kh:streak` repaints anything drawn from the guess. A real 0 is a number: never `x || user_stats.streak`
  (that stored column is stale).
- `renderArticlePage()` skips a rebuild when the article signature is unchanged; cache rows merge
  (`Object.assign`) instead of replacing, so trimmed list rows never wipe full rows.

## Past Incidents — Read Before Touching Article Fetch / Asset Deploy

### 2026-05-16 — Home rail stuck on "Loading today's articles…" (PR #526)

**Symptom:** Home hero + News grid stuck on the loading text forever for every visitor, including incognito on every browser. Stories and Conversations rails on the same page worked fine. Manual `sb.from('articles').select('*')` from the browser console returned 15 rows correctly.

**Real root cause:** The deployed (Cloudflare-cached) `js/core/articles.js` still embedded the *old long* `HOME_ARTICLE_SELECT` with columns that don't exist in the production `articles` table (`source_url`, `view_count`, `video_kind`, …). PostgREST returned `{ data: [], error: null }` (silent empty) for that select — the existing error-only fallback in `loadArticlesFromDB()` therefore never fired.

**Confusing part:** The fix had already landed in `main` weeks earlier (PR #506 trimmed `HOME_ARTICLE_SELECT` to a short whitelist). But Cloudflare was still serving an older build under the same `?v=20260515c` query string, so visitors kept getting the broken bundle.

**Fix (PR #526):** Zero JS logic changes. Just bumped the cache-buster query string (`?v=20260515c` → `?v=20260516a`) on every HTML that includes `articles.js`. That created a new commit (forcing a Cloudflare rebuild) AND a new asset URL (forcing CDN + browser cache miss). The freshly-served `articles.js` had the short, working `HOME_ARTICLE_SELECT`.

**Rules going forward — when in doubt, follow these:**

1. **Bump the cache-buster on EVERY script you change**, no matter how trivial the change. Reusing the same `?v=` after content changes is exactly how stale deploys hide. The grep'able pattern across all HTML pages is `articles.js?v=` etc.
2. **`{ data: [], error: null }` from PostgREST is the schema-drift signature.** If a SELECT against an existing table returns 0 rows but the table has data, suspect a column-name mismatch between the select list and the live schema. The error-only fallback in `loadArticlesFromDB` does NOT catch this.
3. **If only ONE content table breaks (e.g. `articles`) while others (`stories_data`, `conversations_data`) work**, the bug is in *that* table's specific query — not in Supabase auth, RLS in general, or shared client code. Don't waste time on auth/CORS/RLS theories.
4. **Manual console queries can deceive.** A short hand-typed column list may pass while the *deployed* long column list silently returns 0. Always log the deployed value (e.g. `console.log(HOME_ARTICLE_SELECT)`) before testing parity.
5. **Stories / Convo use `select('*')` and are immune to schema drift.** When adding a new "explicit column list" optimization, always pair it with a `*` fallback that triggers on `empty AND no error`, not just on error.

**Open follow-ups (prevention plan):**
- **P0:** Migrate cache-busting from manual `?v=YYYYMMDDx` strings to Vite-injected hashed filenames (`articles.HASH.js`). Eliminates the stale-deploy class of bug entirely.
- **P1:** Post-deploy smoke test workflow — fetch the deployed `articles.js`, extract `HOME_ARTICLE_SELECT`, run it against Supabase as anon, fail the deployment if `rows === 0`.
- **P2:** Schema-vs-code lint in CI — extract every `sb.from('X').select('a,b,c')` literal, cross-check against `information_schema.columns`, fail PR on drift.
- **P3:** Home rail empty-result alerting — `kh_log_error('home_hero_empty')` already fires after 3 retries; add a 5-minute polling Edge Function that pushes a webhook on any `severity='critical'` row.

None of these are in place yet; if this incident class recurs before they're built, that's the order to attack.
