# korehan-news

Korehan static site is connected to **Cloudflare Pages (GitHub integration)**.

## Auto deployment

Any change pushed to `main` is automatically built and deployed by Cloudflare Pages.

- GitHub repo: `enane960819-hub/korehan-news`
- Production branch: `main`
- Production domains:
  - `https://korehannews.com`
  - `https://www.korehannews.com`
- Pages subdomain: `https://korehan-news.pages.dev`

## Manual deploy (optional)

```bash
npx wrangler pages deploy korehan --project-name korehan-news --branch main
```

## First-time setup (for a new contributor)

1. **Clone:** `git clone git@github.com:enane960819-hub/korehan-news.git`
2. **Copy env template:** `cp .env.example .env` and fill in values
   from the owner. (The deployed frontend doesn't read `.env`;
   you need it only for backup scripts and local Edge Function
   testing.)
3. **No build step.** Open `korehan/index.html` in a browser — or
   run `python3 -m http.server 8000 --directory korehan` if you
   want a proper origin (some auth flows need that).
4. **For Edge Function changes:**
   - Install Supabase CLI: `brew install supabase/tap/supabase`
   - `supabase login`
   - `supabase functions serve <name>` runs locally with `.env`
   - `supabase functions deploy <name>` pushes to prod (requires
     owner-level access)
5. **For backup / DR:** see `docs/runbook-backup-restore.md` and
   `docs/runbook-storage-backup.md` — these are the playbooks the
   owner runs weekly + quarterly.

## Project documentation

- `CLAUDE.md` — codebase guide for AI assistants (also useful
  for humans reading the codebase for the first time)
- `docs/runbook-backup-restore.md` — DB backup/restore (DR-F1)
- `docs/runbook-storage-backup.md` — Supabase Storage buckets (DR-F4)
- `docs/runbook-incident-response.md` — "the site is down" decision tree (DR-F2)
- `docs/runbook-data-recovery.md` — "we lost data" recovery scenarios (DR-F10)
- `docs/runbook-key-rotation.md` — rotating secrets (DR-F11)
- `docs/secrets-inventory.md` — where every secret lives (DR-F5)
- `docs/email-deliverability.md` — Resend DKIM/SPF/DMARC + bounce handling
- `docs/db-performance.md` — monthly slow-query review
- `docs/sonnet-haiku-swap-plan.md` — Claude model cost-tier swap plan
