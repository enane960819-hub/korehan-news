# CLAUDE.md — KoreHan News

Korean language learning news platform. Vanilla JS + Supabase + Cloudflare Workers. No framework.

---

## Deploy

```bash
CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy --env production
```

Static assets served from `./korehan/`. Worker handles `/tts` proxy + asset fallback.

---

## Architecture

```
korehan-news/
├── worker.js                    # Cloudflare Worker (TTS proxy + static assets)
├── wrangler.toml                # Deploy config → korehannews.com
├── korehan/
│   ├── korehan-shared.js        # ~5100 lines — ALL shared logic
│   ├── korehan-shared.css       # ALL styling (~91KB)
│   ├── korehan-hover-tooltips.js
│   ├── claude-proxy-index.ts    # Supabase Edge Function (server-side Claude calls)
│   ├── index.html               # Homepage
│   ├── korehan-article.html     # Article reader
│   ├── korehan-mypage.html      # User profile + saved words
│   ├── korehan-study-room.html  # Writing practice + grammar + quizzes
│   ├── korehan-learning-overview.html  # Learning Hub dashboard
│   ├── korehan-conversations.html
│   ├── korehan-stories.html
│   ├── korehan-admin.html       # CMS (~207KB)
│   └── ... (24 HTML pages total)
```

Every HTML page loads `korehan-shared.css` and `korehan-shared.js`. No bundler, no build step.

---

## korehan-shared.js — Key Globals

```js
getSupa()          // Lazy Supabase client (anon key)
supaUser           // Current user object (null if logged out)
callClaude({feature, model, max_tokens, messages})  // Requires auth
getCachedArticles() // In-memory, 1-min TTL
getFromCache(contentType, contentId, cacheKey)  // Reads article_cache table
saveToDbCache(contentType, contentId, key, value)  // Writes article_cache (admin format)
lcGet(key) / lcSet(key, value)  // localStorage cache, 30-day TTL, prefix kh_ai_
toast(msg, isErr)
openAuthModal('signin'|'signup')
```

---

## Claude / AI Integration

**Never call Anthropic directly from the browser.** All AI calls go through:

```
Browser → callClaude() → Supabase Edge Function (claude-proxy) → Anthropic API
```

- Requires active Supabase session (`supaUser` must be set)
- API key stored in `app_settings` table, never in frontend code
- Features: `grammar`, `fill`, `translate`, `quiz`, `feedback`, `generate`
- Model default: `claude-haiku-4-5-20251001`

---

## Caching — 3 Layers

Results are cached to avoid regenerating AI content. **Always check cache before calling AI.**

| Layer | Scope | Auth needed | TTL |
|-------|-------|-------------|-----|
| `lcGet/lcSet` (localStorage) | Per browser | None | 30 days |
| `article_cache` DB table | All users | Supabase session | Permanent |
| In-memory JS vars | Per page load | None | Until reload |

**Cache save format** (must match admin exactly or save fails):
```js
saveToDbCache('article', articleId, 'grammar_guide', { patterns: [...] });
// Internally: JSON.stringify(value) + created_at timestamp
```

**Cache read** handles both string (text column) and object (jsonb column) responses.

**Pattern: always check localStorage → DB → generate AI → save both**

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `articles` | News articles |
| `conversations_data` | Conversation scenarios |
| `stories_data` | Short stories |
| `article_cache` | AI result cache (`content_type`, `content_id`, `cache_key`, `cache_value`, `created_at`) |
| `saved_words` | User bookmarked vocab |
| `user_stats` | XP, streak, level |
| `daily_missions` | Daily task tracking |
| `writing_submissions` | User writing exercises |
| `read_articles` | Article read history |
| `hover_vocab_master` | Hover tooltip definitions |
| `app_settings` | Site config + Anthropic API key |
| `sections` | News categories |
| `xp_log` / `xp_config` | XP system |
| `bookings` / `session_credits` / `available_slots` | Tutoring |

---

## CSS Design System

```css
--accent:  #1a3a6b   /* primary navy blue */
--bright:  #2255a4   /* interactive blue, links, buttons */
--dark:    #0d1b2e   /* body text */
--gray:    #445566   /* secondary text */
--border:  #d4dce8   /* borders */
--bg:      #f0f2f7   /* page background */
--korea:   #cc2200   /* Korea-flag red */
--shadow:  0 4px 18px rgba(0,0,0,0.07)
```

**Fonts:** Playfair Display (headings), Noto Serif KR (Korean display), Noto Sans KR (Korean body), Source Sans 3 (UI)

**Breakpoints:** 980px (tablet), 900px (hide desktop nav), 640px (mobile)

**No dark mode** — `color-scheme: light only`

---

## UI Language

**All UI text must be in English.** No Korean strings in buttons, labels, tabs, or error messages. Korean appears only in learning content (articles, vocabulary, examples).

---

## Key Conventions

**Reading files:** Always read a file before editing it (Edit tool requirement).

**Dropdowns:** `overflow: hidden` on any ancestor clips absolutely-positioned dropdowns. Use `overflow: visible`.

**Hero slideshow:** Split into `.kh-hero-main` (animated) and `.kh-hero-aside` (static). Use opacity crossfade on main only — never replace full innerHTML.

**Grammar study links:** From Grammar Guide → Study Room via `?mode=grammar&g=JSON`. `URLSearchParams.get()` auto-decodes — do NOT call `decodeURIComponent()` again on the result.

**Tab navigation across pages:** Use URL hash e.g. `korehan-mypage.html#level` to open specific tabs on arrival.

**Admin cache writes:** The `article_cache` table requires `created_at` and `JSON.stringify(value)` — use `saveToDbCache()` helper, not raw upsert.

**`callClaude` requires login:** Always check `supaUser` before making AI calls and handle `'Not signed in'` error with a sign-in prompt, not an error toast.

---

## Page Roles

| Page | Role |
|------|------|
| `index.html` | Homepage — hero, today's phrase, cards |
| `korehan-article.html` | Article reader — vocab hover, grammar guide, fill-in-blank, translate |
| `korehan-mypage.html` | Profile — saved words, activity, stats (learning features moved to Learning Hub) |
| `korehan-learning-overview.html` | Learning Hub — all study tools, progress, reading history |
| `korehan-study-room.html` | Writing practice + grammar modal + listening quiz + flashcards |
| `korehan-conversations.html` | Conversation cards by category + level filter |
| `korehan-stories.html` | Short stories by mood |
| `korehan-admin.html` | CMS — articles, conversations, stories, vocab, phrases |

---

## Git

Branch: `claude/analyze-codebase-1EL45`

```bash
git add <files>
git commit -m "message\n\nhttps://claude.ai/code/session_01CedURBU7TUH3dFZgey2GBR"
git push -u origin claude/analyze-codebase-1EL45
```
