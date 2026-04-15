<!-- sync marker -->
# CLAUDE.md — KoreHan News: AI Assistant Guide

## Project Overview

KoreHan News is a **Korean language learning platform** delivered as a static web application. Users read real Korean news articles, stories, and conversations at different TOPIK levels, and the platform tracks vocabulary, grammar, reading, and quiz progress across five learning axes.

**Live infrastructure:**
- Frontend: Static HTML/CSS/JS files hosted on **Netlify**
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
│   ├── learning_hub_client.js      # Learning hub RPC helpers
│   ├── claude-proxy-index.ts       # TypeScript reference for Edge Function
│   ├── _headers                    # Netlify HTTP header configuration
│   └── learning_hub_integration_guide.md  # Learning hub feature documentation
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
| Hosting | Netlify (static file serving) |
| Package manager | None — no build step required |

---

## Build & Deployment

**There is no build process.** Files in `korehan/` are deployed directly to Netlify as static assets.

- Changes to HTML/JS/CSS are effective immediately on deploy
- No `npm install`, no transpilation, no bundling
- Deploy by pushing to the connected git remote (Netlify auto-deploys)
- The `_headers` file controls HTTP caching and security headers on Netlify

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

### `korehan/learning_hub_client.js`
Wraps all Learning Hub RPC calls. Use these functions instead of calling RPCs directly:
- `logReadEvent(contentType, contentId, ...)` → `log_read_event()`
- `saveOrUpdateWord(word, ...)` → `save_or_update_word()`
- `logQuizResult(...)` → `log_quiz_result()`
- `getLearningHubSnapshot()` → `get_learning_hub_snapshot()`
- `assignDailyVocab()` → `assign_daily_vocab()`

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
5. The `_headers` file sets security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` restricting camera/mic/geolocation

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
Use `learning_hub_client.js` helpers if available. If adding a new RPC:
1. Create the function in Supabase SQL editor
2. Add a wrapper in `learning_hub_client.js`
3. Call the wrapper from your page

---

## Git Workflow

- **Production branch: `main`** — Cloudflare Pages deploys from `main`. Always merge to `main`, never `master`.
- Feature branches: `claude/[description]-[id]` for AI-assisted changes
- Workflow: feature branch → PR → merge to `main` → Cloudflare auto-deploys
- `master` branch is deprecated — do not push to it
- Commit messages should be descriptive and imperative: `Fix vocab quiz button: use tab=vocab`
- No CI/CD pipeline — push triggers Netlify auto-deploy for frontend

---

## Known Patterns & Gotchas

- **Large HTML files**: `korehan-admin.html` (207KB) and `korehan-study-room.html` (141KB) contain significant inline JS and CSS. When editing, be precise about which section you are modifying.
- **No build step**: Any linting or formatting must be done manually — there are no pre-commit hooks.
- **Caching disabled**: `_headers` sets `Cache-Control: no-cache` for all assets. This is intentional to ensure users always get fresh content.
- **Daily vocab assignment**: `assign_daily_vocab()` pulls 20 words from `vocabulary_bank` and deduplicates across days. The cache logic in the frontend deduplicates within a day using a timestamp check.
- **Article cache**: `article_cache` stores AI-generated vocab/grammar/mission per article. If fewer than 5 vocabulary items exist in the cache for an article, the cache is considered stale and regenerated.
- **Timezone handling**: Daily progress calculations use the user's local timezone — ensure date comparisons account for this.
