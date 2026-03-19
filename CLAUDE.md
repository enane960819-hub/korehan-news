# CLAUDE.md — KoreHan News

AI assistant reference for the KoreHan News codebase.

---

## Project Overview

**KoreHan News** is a Korean language learning platform. Users read real Korean news, conversations, and stories at their proficiency level, with vocabulary tooltips, AI-powered feedback, grammar/vocab quizzes, and a progress tracking hub.

**Live hosting:** Static site on Netlify (indicated by `korehan/_headers`)
**Backend:** Supabase (database, auth, edge functions)
**AI:** Anthropic Claude API proxied through a Supabase Edge Function

---

## Repository Structure

```
korehan-news/
├── CLAUDE.md                          ← this file
├── korehan/                           ← all deployable files
│   ├── _headers                       ← Netlify cache/security headers
│   ├── korehan-shared.js              ← shared JS (auth, Supabase client, utils)
│   ├── korehan-shared.css             ← shared CSS design system
│   ├── korehan-hover-tooltips.js      ← hover vocab tooltip system
│   ├── learning_hub_client.js         ← learning tracking RPC wrappers
│   ├── index.html                     ← home page
│   ├── korehan-admin.html             ← CMS admin dashboard
│   ├── korehan-study-room.html        ← interactive grammar/vocab practice
│   ├── korehan-learning-overview.html ← learning hub (stats, review queue)
│   ├── korehan-mypage.html            ← user profile + read history
│   ├── korehan-conversations.html     ← real-text conversations by category
│   ├── korehan-stories.html           ← interactive stories
│   ├── korehan-learn.html             ← grammar/vocab resources
│   ├── korehan-courses.html           ← structured courses
│   ├── korehan-onboarding.html        ← onboarding flow
│   ├── beginner-guide.html            ← beginner guide
│   ├── korehan-admin-hover-vocab.html ← admin: hover vocab management
│   ├── korehan-admin-phrases.html     ← admin: daily phrases
│   ├── korehan-news.html              ← news article detail
│   ├── korehan-article.html           ← article reader (vocab/grammar inline)
│   ├── korehan-phrase.html            ← phrase detail
│   ├── korehan-all.html               ← all content index
│   ├── korehan-section.html           ← section/category page
│   └── [category pages]               ← society, world, culture, korea, opinion
└── learning_hub_integration_guide.md  ← DB schema + integration docs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 — **no framework** |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Anthropic Claude API (`claude-proxy` edge function) |
| Fonts | Google Fonts (Noto Serif KR, Noto Sans KR, Playfair Display, DM Sans) |
| Hosting | Netlify (static) |
| Build tools | **None** — plain files, no transpilation, no bundler |

---

## Key Source Files

### `korehan/korehan-shared.js` (4,847 lines)

The core shared module. Every HTML page loads this first. It provides:

- **Supabase client init** — `SUPA_URL`, `SUPA_KEY` constants at the top (lines 6–7)
- **Session management** — `getSession()`, `requireAuth()`, auto-refresh
- **Claude AI proxy** — `callClaudeAPI(messages, options)` calls the edge function
- **Article cache** — reads/writes `article_cache` table (vocab, grammar, missions per article)
- **Auth UI** — signin/signup/password-reset modals, toast notifications
- **Navigation** — header rendering, filter pills, active states

### `korehan/korehan-shared.css` (2,268 lines)

Design system. Uses CSS custom properties:

```css
--accent: #cc2200   /* red accent */
--navy:   #0b1626   /* dark navy background */
--blue:   #1a3a6b   /* medium blue */
--bright: #2563eb   /* bright blue */
--sky:    #38bdf8   /* sky blue */
```

Typography: Noto Serif KR (headings), Noto Sans KR (body), Playfair Display (decorative).

### `korehan/korehan-hover-tooltips.js` (272 lines)

- Loads vocabulary from `hover_vocab_master` Supabase table on page load
- Uses regex matching + `MutationObserver` to wrap matched words in tooltip spans
- Positions tooltips dynamically to avoid viewport edges

### `korehan/learning_hub_client.js` (154 lines)

RPC wrapper functions for learning tracking. Call these when key events occur:

| Function | Trigger |
|----------|---------|
| `logReadEvent(type, id)` | User finishes reading article/conversation/story |
| `saveWord(wordKey)` | User saves a vocabulary word |
| `logQuizResult(type, correct)` | User answers a grammar or vocab quiz |
| `getLearningHubSnapshot()` | Render the learning hub dashboard |
| `assignDailyVocab()` | Assign 20 daily words at session start |

### `claude-proxy-index.ts` (Supabase Edge Function)

- Verifies JWT for authenticated users
- Admin requests bypass with service role key
- Fetches Claude API key from `app_settings` table
- Proxies to `https://api.anthropic.com/v1/messages`

---

## Supabase Database Tables

| Table | Purpose |
|-------|---------|
| `article_cache` | Cached AI analysis per article (vocab, grammar, missions) |
| `conversations_data` | Conversation content |
| `stories_data` | Story content |
| `hover_vocab_master` | Master list of hover tooltip vocabulary |
| `vocabulary_bank` | Source vocab for daily assignments (`word_key`, `word_ko`, `word_rom`, `word_en`, `interest_tag`) |
| `app_settings` | Config values including Claude API key |
| `learning_hub_*` | Multiple tables for learning progress tracking |

**RPC functions:**
- `log_read_event(content_type, content_id)`
- `save_or_update_word(word_key)`
- `log_quiz_result(quiz_type, is_correct)`
- `get_learning_hub_snapshot()` → returns 7-day stats + review queue
- `assign_daily_vocab()` → returns 20 words for today

---

## Development Workflow

### No build step required

All files are plain HTML/CSS/JS. To develop locally:

1. Open any `.html` file directly in a browser, **or**
2. Use a local static server: `python3 -m http.server 8080` from `korehan/`

### Making changes

1. Edit files directly in `korehan/`
2. Refresh browser — no compile step
3. JS from CDN: Supabase JS v2 loaded via jsdelivr — no npm needed
4. Test auth flows: requires live Supabase connection (credentials in `korehan-shared.js`)

### Deployment

- Push to the connected Netlify branch (typically `master`)
- Netlify auto-deploys on push
- Cache headers in `korehan/_headers` enforce no-cache for HTML/JS/CSS

---

## Coding Conventions

### JavaScript

- **No framework, no modules** — all JS is global scope within each HTML file, with `korehan-shared.js` loaded as a `<script>` tag first
- **Async/await** preferred over `.then()` chains
- **Supabase client** is the global `supabase` object initialized in `korehan-shared.js`
- Functions that need auth should call `await requireAuth()` at the top
- Toast notifications: `showToast(message, type)` where type is `'success'`, `'error'`, `'info'`
- Each HTML page is self-contained — page-specific JS lives in a `<script>` block at the bottom

### CSS

- Add component styles to `korehan-shared.css` if reusable across pages
- Page-specific styles go in a `<style>` block in the HTML `<head>`
- Always use CSS custom properties for colors — never hardcode hex values
- Mobile-first responsive design — use `@media (max-width: 768px)` for mobile overrides
- Korean text: use `word-break: keep-all` to prevent awkward line breaks

### HTML structure (each page)

```html
<head>
  <link rel="stylesheet" href="korehan-shared.css">
  <style>/* page-specific styles */</style>
</head>
<body>
  <!-- header rendered by shared.js -->
  <div id="main-content">...</div>
  <!-- mobile bottom nav -->
  <script src="korehan-shared.js"></script>
  <script src="learning_hub_client.js"></script>
  <script>/* page-specific logic */</script>
</body>
```

### Mobile bottom navigation

The bottom nav is present on most pages. Tabs:
- Home (`index.html`)
- Explore / content browsing
- Study Room (`korehan-study-room.html`)
- Daily Missions
- Profile / My Page (`korehan-mypage.html`)

---

## AI Integration

Claude is called via the Supabase edge function proxy. Usage pattern:

```javascript
const response = await callClaudeAPI([
  { role: 'user', content: 'Your prompt here' }
], {
  model: 'claude-opus-4-6',  // or claude-sonnet-4-6, claude-haiku-4-5
  max_tokens: 1024
});
```

The function is defined in `korehan-shared.js`. It handles auth headers automatically.

---

## Content Types

| Type | Korean Level | Notes |
|------|-------------|-------|
| News articles | Beginner / Intermediate / Advanced | Filtered by difficulty pill |
| Conversations | All levels | Organized by context (everyday, workplace, family, dating) |
| Stories | All levels | Categories: fun, touching, scary, shocking |
| Daily phrases | Beginner-friendly | Shown on homepage |

---

## Known Patterns & Gotchas

1. **Credentials in source** — Supabase URL and anon key are embedded directly in `korehan-shared.js`. The anon key is safe to expose (enforced by RLS), but document this if adding new secrets.
2. **No test suite** — all testing is manual via browser. When making changes, test each affected HTML page directly.
3. **Admin pages** — `korehan-admin.html` and `korehan-admin-hover-vocab.html` require admin role. Supabase RLS enforces this server-side.
4. **Cache table** — AI analysis results are cached in `article_cache` to avoid redundant API calls. If regenerating analysis, delete the relevant cache rows first.
5. **MutationObserver in tooltips** — `korehan-hover-tooltips.js` watches for DOM changes so tooltips apply to dynamically loaded content. Load it after content is rendered.
6. **Korean font loading** — Google Fonts CDN adds ~200–400ms latency. Critical text should use system fallbacks until fonts load.

---

## Security Headers (`korehan/_headers`)

Applied to all routes:
- `Cache-Control: no-cache, no-store, must-revalidate`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Git Branch Conventions

- Main branch: `master`
- AI/Claude feature branches: `claude/<description>-<sessionId>`
- Commit messages: describe what changed (e.g. `Add learning hub link to progress banner`)
