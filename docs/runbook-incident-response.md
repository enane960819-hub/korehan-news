# Incident response runbook

Closes **DR-F2** from audit 16. First doc to read when "something
is broken". Decision tree, not a comprehensive guide.

---

## Step 0 — Is the alarm wired?

If you're reading this because **someone told you the site is down**
(not because Discord pinged you), the alarm system itself isn't
working. Fix that first:

1. Check `app_settings.error_notify_webhook` is set (Supabase
   SQL editor):
   ```sql
   SELECT key, value FROM app_settings WHERE key = 'error_notify_webhook';
   ```
2. Check `notify-critical-error` Edge Function is deployed:
   `supabase functions list`
3. Manually fire a test alert:
   ```sql
   INSERT INTO client_errors (message, context, severity, user_agent)
   VALUES ('Test alarm — please ignore', '{"source":"manual_test"}'::jsonb, 'critical', 'manual');
   ```
   If Discord doesn't ping within 30s, the alarm is broken — fix
   per `notify-critical-error` deploy instructions in
   `docs/email-deliverability.md` (the AN-F2 setup section).

---

## Step 1 — Triage in 60 seconds

Open these 4 dashboards in tabs. Whichever is **red** is your
incident root cause; if all green, move to Step 2.

| Service | URL | What it'd tell you |
|---|---|---|
| Cloudflare Pages | `dash.cloudflare.com` → KoreHan project | Last deploy status; if "Failed", static site is stale |
| Supabase | `supabase.com/dashboard/project/<ref>` | Project health; DB up/down; recent migration errors |
| Anthropic | `status.anthropic.com` | Claude API outage = all AI features 500 |
| Stripe | `status.stripe.com` | Checkout broken = payments dead (currently unused but watch) |

**Most-common diagnosis by symptom:**

- "Home page blank" → Cloudflare deploy failed OR `articles` table returns 0 rows (PR #526-class schema drift). Check `client_errors` for `home_hero_empty`.
- "Can't sign in" → Google OAuth (status.google.com) OR Supabase Auth.
- "Comments fail" → RLS regression on `comments` table OR `submit_comment` RPC dropped.
- "AI feature times out" → Anthropic outage OR `claude-proxy` Edge Function hit its 90s timeout.
- "Email confirmation never arrives" → Resend status OR DNS records broken (see `docs/email-deliverability.md`).

---

## Step 2 — Read the smoke detectors

```sql
-- Last 50 critical errors (Discord webhook fires off these)
SELECT created_at, message, context->>'source' AS source, url
FROM client_errors
WHERE severity = 'critical'
ORDER BY created_at DESC
LIMIT 50;

-- Last hour of any errors
SELECT severity, count(*) FROM client_errors
WHERE created_at > now() - interval '1 hour'
GROUP BY severity ORDER BY 2 DESC;
```

```sh
# Supabase function logs (1-7 day retention on Free)
supabase functions logs claude-proxy --tail
supabase functions logs daily-content-gen --tail
supabase functions logs notify-critical-error --tail
```

---

## Step 3 — Roll back if a recent deploy is suspected

### Cloudflare Pages (the frontend)

Dashboard → Deployments → find a green "working" deployment →
"⋯" menu → **Rollback to this deployment**. One click. No CLI
fallback needed.

If the dashboard is itself broken: `git revert <bad-sha> && git push origin main`
forces a new deploy that re-applies the last known good state.

### Supabase Edge Functions

```sh
# Find the git SHA of the last known good deploy
git log --oneline supabase/functions/<fn-name>/index.ts | head

# Roll back that one function from that SHA
git checkout <good-sha> -- supabase/functions/<fn-name>/index.ts
supabase functions deploy <fn-name>
# Then either revert the working-tree change or commit the rollback:
git checkout HEAD -- supabase/functions/<fn-name>/index.ts
```

### Supabase migrations

You can't trivially "revert" a migration — the migration files
are append-only history. To roll back a schema change, write a
**new** migration that inverts it (e.g. `DROP INDEX`, `ALTER TABLE
DROP COLUMN`, etc.) and apply that. Don't `git revert` migration
files — that just removes them from history without undoing the
schema change in production.

---

## Step 4 — Communicate

If down for >5 minutes:
1. Reply on the contact email (`hello@korehani.com`) acknowledging
   the issue.
2. (Future) Update `status.korehani.com`.
3. (Future) Discord announce if a user channel exists.

---

## Step 5 — Post-mortem template

After the fire is out, create a markdown note in `docs/incidents/`:

```
# YYYY-MM-DD — <short title>

## Symptom
What broke, who reported it, when.

## Detect time
How long between break and detect. (Goal: <5 min via Discord alarm.)

## Root cause
One sentence.

## Fix
What we did. PR link.

## Prevention
What we'll do so it doesn't repeat. Audit follow-up if applicable.
```

CLAUDE.md "Past Incidents" section is where we promote noteworthy
incidents — patterns that should change future Claude Code
behavior. The PR #526 home-rail incident is the template.
