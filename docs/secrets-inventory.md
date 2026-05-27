# Secrets inventory

Closes **DR-F5** from audit 16. Where every secret lives, who
can read it, and what breaks if it's revoked. Pairs with
`docs/runbook-key-rotation.md` (the HOW) — this doc is the
WHERE.

Update this file whenever a secret is added, removed, or
relocated. If something in production reads a key that isn't
on this list, the list is wrong.

---

## Quick scan — all secrets

| Secret | Location | Read by | Rotation cadence | Breakage on revoke |
|---|---|---|---|---|
| `anthropic_key` | `app_settings` (DB row) | `claude-proxy` | Yearly | All AI features 401 immediately |
| Supabase service-role key | Edge Function secrets + admin localStorage | All admin Edge Functions, admin panel | Yearly | Admin tools, account delete, newsletter all 401 |
| Supabase anon JWT | `korehan-shared.js` (hardcoded, public) | Browser | Whenever service-role rotates | Old sessions 401 until refresh |
| `STRIPE_SECRET_KEY` | Edge Function secrets | `speaking-pass-webhook` | Yearly | Payment processing dies (currently unused — Speaking Coach v3 is inactive) |
| `STRIPE_WEBHOOK_SECRET` | Edge Function secrets | `speaking-pass-webhook` | Yearly | Stripe webhooks rejected with 400 |
| `RESEND_API_KEY` | Edge Function secrets | `newsletter-send`, `notify-critical-error` | Yearly | Newsletter + error alerts can't send |
| `RESEND_WEBHOOK_SECRET` (Svix) | Edge Function secrets | `resend-webhook` | Yearly | Bounce/complaint events rejected — list quality degrades |
| `error_notify_webhook` (Discord) | `app_settings` (DB row) | `notify-critical-error` | Yearly | Critical-error alarm goes silent |
| Google OAuth client secret | Supabase Dashboard → Auth → Providers | Supabase Auth (internal) | Yearly | Sign-in-with-Google breaks |
| Cloudflare API token | Owner's local `~/.wrangler/` | `wrangler` CLI on owner's machine | Yearly | Manual deploys break (auto-deploy from main still works) |
| GitHub PAT | Owner's local `.netrc` / `gh auth` | `gh` / `git` on owner's machine | Yearly | Owner's local git pushes break |
| Postgres password | Supabase Dashboard → Database | `pg_dump` for off-site backups | On compromise only | Backup script breaks; in-app DB access unaffected |

---

## Where each lives in detail

### 1. `anthropic_key` — Anthropic Claude API key

- **Storage:** `app_settings` table, row WHERE key='anthropic_key'.
- **Why there (not env var):** so owner can rotate via SQL editor
  without a redeploy. `claude-proxy` reads it on every invocation.
- **Access path:** service-role can SELECT it; anon cannot (RLS
  on `app_settings` is admin-only). Confirm with:
  ```sql
  SELECT polname, polcmd FROM pg_policy
  WHERE polrelid = 'public.app_settings'::regclass;
  ```
- **Backup copy?** No — owner must save the new key in
  1Password / Bitwarden at rotation time.

### 2. Supabase service-role key

- **Storage:** Edge Function secrets (`supabase secrets list`).
- **Where else it shows up:** Admin panel's `x-admin-bypass`
  flow — fetched from the auth session, NOT persisted to
  localStorage.
- **Reset is destructive:** Supabase doesn't have an overlap
  window for service-role rotation. Plan a coordinated swap
  per `runbook-key-rotation.md`.

### 3. Supabase anon JWT (public)

- **Storage:** `korehan/korehan-shared.js` as `SUPA_KEY`
  constant. **Intentionally public** — exposed in every browser.
- **Security depends on RLS, not on the key being secret.** If
  this key gets "leaked", it's not a compromise; if RLS is
  misconfigured AND the key is leaked, then it's a problem.
- **Audit RLS quarterly** to keep this guarantee true.

### 4. Stripe keys

- **Storage:** Edge Function secrets only. Never in DB, never
  client-side, never in commits.
- **Live-mode vs Test-mode:** Speaking Coach v3 is unused → keys
  are likely test-mode. If you flip to live, document the swap
  here.

### 5. Resend keys

- **`RESEND_API_KEY`:** outbound email auth. One key per
  environment (we only have prod).
- **`RESEND_WEBHOOK_SECRET`:** inbound Svix signature key for the
  bounce/complaint endpoint. Resend generates a different one per
  webhook endpoint — if you have multiple endpoints (rare),
  multiple secrets.

### 6. Discord webhook URL

- **Storage:** `app_settings` row, key='error_notify_webhook'.
- **Treat as secret:** anyone with this URL can post to the
  alert channel. Don't share screenshots of the SQL value.
- **Discord auto-revokes if the bot is kicked from the server**
  — alarm dies silently. Run the manual fire-an-alarm check
  monthly per the incident-response runbook.

### 7. Google OAuth client secret

- **Storage:** Supabase Dashboard → Auth → Providers → Google.
  NOT in any code file.
- **Mirror in:** Google Cloud Console → Credentials. The two
  must match. Mismatch → sign-in errors.
- **Has TWO-secret rolling support:** can have 2 active secrets
  in Google Cloud at once for clean rotation.

### 8. Owner-local secrets (Cloudflare token, GitHub PAT, Postgres password)

- **Storage:** owner's machine only.
- **Recovery if owner machine is lost:** Cloudflare token →
  regenerate via dashboard. GitHub PAT → regenerate via
  Settings. Postgres password → reset via Supabase dashboard.
- **No team yet** → no shared password manager required, but
  when a teammate joins, this whole inventory must be put in
  1Password / Bitwarden with shared access.

---

## Who has access right now

| Person | Role | Access |
|---|---|---|
| Owner (enane960819@gmail.com) | Sole admin | ALL of the above |
| Claude Code (this assistant) | Cannot retain secrets — every session starts fresh | None persistently. Can READ values via Supabase tools during a session but values are not saved across sessions. |

When a teammate is added:

1. Put every entry in a shared 1Password vault.
2. Set up a per-teammate Supabase account (don't share the
   owner login).
3. Decide which secrets they need — most teammates only need
   the anon key and a personal service-role-equivalent JWT.
4. Update the table above with the new person.

---

## Verification — run this monthly

```sh
# What's currently in Edge Function secrets?
supabase secrets list
```

Expected output (names only; values are hidden):

- `ANTHROPIC_KEY` — should NOT be set here (lives in `app_settings`
  instead). If you see it, delete it.
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

If extra unexpected secrets appear → investigate (probably a
debug/test leftover). If expected secrets are missing →
something will be 500ing in prod.

```sql
-- What's currently in app_settings?
SELECT key FROM app_settings ORDER BY key;
```

Expected keys:

- `anthropic_key`
- `error_notify_webhook`
- (possibly) feature-flag rows like `home_rail_enabled`

Any unrecognized key → audit it. Don't blindly delete — could
be load-bearing for an experiment.

---

## On committing secrets to git by accident

1. Rotate IMMEDIATELY (don't try to scrub git history first —
   the leaked value is already on attackers' radar from public
   GitHub scrapers).
2. After rotation, scrub history with `git filter-repo` or
   BFG Repo Cleaner. Force-push (this is the ONE case where
   destructive history rewrite is correct).
3. Add the leaked file pattern to `.gitignore` and a
   `git secrets` pre-commit hook if you haven't already.
4. File a post-mortem under `docs/incidents/`.
