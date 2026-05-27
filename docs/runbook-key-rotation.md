# Key rotation runbook

Closes **DR-F11** from audit 16. How to rotate every secret /
key the platform uses, without downtime. Walk this whole list
on a schedule (yearly minimum) and immediately on any suspected
compromise.

> **The rotation principle:** old key + new key must BOTH work
> for a short overlap window. Cut over reads first, then writes,
> then revoke the old key. Anything that skips the overlap
> window causes a flicker of 401s in production.

---

## Secrets inventory at a glance

See `docs/secrets-inventory.md` for the full table of where each
secret lives + who has access. This document is the HOW for
each rotation; the inventory is the WHERE.

---

## ANTHROPIC_KEY — Claude API key

**Stored in:** `app_settings` table, key `anthropic_key`.
**Used by:** `claude-proxy` Edge Function (reads on every Claude call).

### Procedure (no downtime)

1. **Generate new key** at `console.anthropic.com` →
   Settings → API keys → Create. Name it
   `korehani-prod-YYYYMM`.
2. **Verify the new key works** with a curl:
   ```sh
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: <new-key>" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'
   ```
   Expect a 200 with a tiny response.
3. **Swap in app_settings** (atomic — one UPDATE, claude-proxy
   re-reads on next invocation):
   ```sql
   UPDATE app_settings
   SET value = '<new-key>'
   WHERE key = 'anthropic_key';
   ```
4. **Smoke-test from the app:** open a Korean article, click
   "🤖 분석" — should produce vocab + grammar within ~15s.
5. **Revoke the old key** at `console.anthropic.com`. Wait
   24h before doing this if anxious — the new key has been
   live for that long with no errors and it's safe to revoke.

---

## SUPABASE service-role key

**Stored in:**
- `.env` files on owner's local machine (`SUPABASE_SERVICE_KEY`).
- Edge Function secrets (`supabase secrets list`).
- Admin panel localStorage (the `x-admin-bypass` flow). **Verify before rotating.**

**Used by:** `claude-proxy` admin-bypass path, `delete-account`,
`export-my-data`, `newsletter-send`, `notify-critical-error`,
`speaking-pass-webhook`, `resend-webhook`.

### Procedure

1. **Generate new key:** Supabase Dashboard → Project Settings →
   API → "Reset service role key" (or use Settings → API → New
   secret if Supabase exposes one). **WARNING:** Supabase's
   "Reset" is a SWAP — it immediately invalidates the old key.
   No overlap window. Coordinate with Edge Function redeploy.
2. **Update Edge Function secrets** (before Reset if possible —
   Supabase reads from `Deno.env`, secrets are pushed at
   function-invocation):
   ```sh
   supabase secrets set SUPABASE_SERVICE_KEY=<new-key>
   ```
3. **Click Reset in Supabase dashboard.** Old key dies here.
4. **Re-deploy every Edge Function** so they pick up the new
   secret:
   ```sh
   for fn in claude-proxy delete-account export-my-data newsletter-send notify-critical-error speaking-pass-webhook resend-webhook; do
     supabase functions deploy "$fn"
   done
   ```
5. **Update local `.env`** files on every dev machine.
6. **Test:** admin panel → "Generate adapted articles" (uses
   service-role bypass). Should succeed.

**If admin localStorage still has the old key:** clear it. The
admin panel is supposed to fetch the service key on login, not
persist it; double-check the auth flow if you find stale keys.

---

## SUPABASE anon (public) key

**Stored in:** `korehan/korehan-shared.js` as a hardcoded constant
(`SUPA_KEY`). **It's a PUBLIC key — RLS is the actual security.**

### Procedure

Supabase rotates the anon JWT signing key in lockstep with the
service-role reset. So:

1. After service-role rotation completes, grab the new anon key
   from Project Settings → API.
2. Update `korehan/korehan-shared.js` `SUPA_KEY`.
3. **Bump the cache-buster** on every script that imports the
   client (per PR #526 lessons — don't rely on Cloudflare to
   refresh):
   ```sh
   git grep -l 'korehan-shared.js?v=' korehan/ | xargs sed -i 's/korehan-shared.js?v=YYYYMMDDx/korehan-shared.js?v=YYYYMMDDy/g'
   ```
4. Commit + push → Cloudflare auto-deploys.
5. Old sessions will silently get 401s on writes until they
   hard-refresh. Banner the site or just wait it out — anon-key
   refresh is short-lived pain.

---

## Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

**Stored in:** Edge Function secrets only.
**Used by:** `speaking-pass-webhook`.

### Procedure

1. Stripe Dashboard → Developers → API keys → "Roll" the secret
   key. Stripe gives you a 24-hour overlap window where BOTH
   the old and new key authenticate.
2. `supabase secrets set STRIPE_SECRET_KEY=<new>` →
   re-deploy `speaking-pass-webhook`.
3. Test a $1 charge on a test Stripe key first if you're nervous.
4. After 24h, click "Reveal" on the old key in Stripe → "Delete"
   to confirm revocation.

For `STRIPE_WEBHOOK_SECRET`: Dashboard → Developers → Webhooks →
your endpoint → "Roll secret". 24h overlap. Update + redeploy as
above.

---

## RESEND_API_KEY

**Stored in:** Edge Function secrets.
**Used by:** `newsletter-send`, `notify-critical-error` (Discord
fallback uses Resend if Discord webhook is dead).

### Procedure

1. resend.com → API keys → "Create" a new key with the same
   permissions as the old one. **DON'T delete the old one yet.**
2. `supabase secrets set RESEND_API_KEY=<new>` →
   re-deploy `newsletter-send`.
3. Send yourself a test newsletter → verify delivered.
4. resend.com → revoke the old key.

---

## RESEND_WEBHOOK_SECRET (Svix signature)

**Stored in:** Edge Function secrets.
**Used by:** `resend-webhook`.

Resend doesn't currently support webhook secret rotation
without a brief window where bounces/complaints get rejected.
Acceptable trade-off — bounce events retry for 24h.

1. resend.com → Webhooks → your endpoint → "Reveal" the new
   secret (create a new endpoint if necessary, or roll the
   existing one if Resend exposes that option).
2. `supabase secrets set RESEND_WEBHOOK_SECRET=<new>` → redeploy.

---

## Discord webhook URL (`DISCORD_NOTIFY_WEBHOOK`)

**Stored in:** `app_settings` table, key `error_notify_webhook`.
**Used by:** `notify-critical-error`.

### Procedure

1. Discord server → Channel settings → Integrations → Webhooks →
   "New Webhook" (or "Reset URL" on the existing one).
2. Copy the new URL.
3. ```sql
   UPDATE app_settings
   SET value = '<new-url>'
   WHERE key = 'error_notify_webhook';
   ```
4. Fire a test alarm per `runbook-incident-response.md` Step 0.

---

## Google OAuth client secret

**Stored in:** Supabase Dashboard → Authentication → Providers →
Google.
**Used by:** Sign-in-with-Google flow.

### Procedure

1. console.cloud.google.com → APIs & Services → Credentials →
   your OAuth 2.0 client → "Add secret" (you can have 2 secrets
   active at once).
2. Copy the new secret.
3. Supabase Dashboard → Authentication → Providers → Google →
   paste new client secret → Save.
4. Test a sign-in.
5. Google Cloud Console → delete the OLD secret after 24h.

---

## Cloudflare API token (for `wrangler` deploys)

**Stored in:** Owner's local machine `~/.wrangler/config/`.
**Used by:** Manual `wrangler pages deploy` (rare — usually
auto-deploy from main).

1. Cloudflare Dashboard → My Profile → API Tokens → roll your
   token.
2. `wrangler logout && wrangler login`.

Not a production hot path so 30s of friction is fine.

---

## GitHub personal access token (PAT)

**Stored in:** owner's local `.netrc` or `gh auth login`.

Standard GH process — github.com → Settings → Developer settings
→ Personal access tokens → regenerate. No code-level impact.

---

## Yearly checklist

Pin this to your calendar (Jan 1, every year):

- [ ] ANTHROPIC_KEY rotated
- [ ] SUPABASE service-role key rotated (and anon key updated in
      frontend)
- [ ] STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET rotated
- [ ] RESEND_API_KEY + RESEND_WEBHOOK_SECRET rotated
- [ ] DISCORD_NOTIFY_WEBHOOK rolled
- [ ] Google OAuth client secret rotated
- [ ] Cloudflare API token rotated
- [ ] Verify `docs/secrets-inventory.md` is current (no entries
      removed/added since last year)
- [ ] Run a `runbook-backup-restore.md` restore drill on the
      latest dump — confirms the freshly-rotated keys still work

---

## On compromise (not scheduled rotation)

If you have any reason to believe a key leaked (committed to git,
shared in a screenshot, an Edge Function log got scraped, etc.):

1. **Revoke first, ask later.** Yes there'll be a few minutes
   of 5xx — that's preferable to a leaked key being exploited.
2. After revocation, audit usage:
   - Anthropic: console.anthropic.com → Usage → look for spikes.
   - Stripe: Dashboard → Logs → unusual events.
   - Supabase: Dashboard → Logs → suspicious queries.
3. Rotate ALL related keys, not just the leaked one. If
   ANTHROPIC_KEY leaked from an Edge Function log, the service
   role key that read it also lived in that same log scrape.
4. Add a post-mortem entry under `docs/incidents/`.
