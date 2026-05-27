# Email deliverability checklist — `korehani.com`

Operator-facing reference for the email-deliverability remediation
from the 12th audit. The code-side fixes (preheader, Reply-To,
plain-text fallback, 429 retry, locale-aware templates, token
expiry, consent audit, bounce webhook) shipped in PRs; the items
on this page are owner actions that live OUTSIDE the repo.

The headline reality: per **Gmail / Yahoo Feb 2024 bulk-sender rules**
(now also enforced by Outlook 2025), any sender that emits >5 k
messages/day from a domain without authenticated SPF + DKIM +
DMARC alignment gets junked or rejected. KoreHani is currently
below that threshold, but signup-confirm and password-reset
emails (single-recipient transactional) still suffer from poor
deliverability without DKIM. **Fix this BEFORE the next user
acquisition push.**

---

## 1. Resend dashboard verification

1. Log into <https://resend.com/domains>.
2. Add `korehani.com` (apex). For subdomain-scoped sends use
   `mail.korehani.com` instead — keep things simple by using apex
   unless you have a separate marketing-DNS plan.
3. Resend will display three CNAME records. **Add all three.**
   The DKIM records look like
   `resend._domainkey.korehani.com → resend.com`-style CNAMEs.
4. Wait for "verified" green check — usually 5–30 minutes
   depending on Cloudflare DNS propagation.

---

## 2. DNS records (Cloudflare DNS panel)

These are the minimum three. Owner adds in Cloudflare DNS → Records.

### SPF (one TXT record on the apex)
```
korehani.com.    TXT    "v=spf1 include:_spf.resend.com ~all"
```

If you also send through Google Workspace or another provider, MERGE
into one record (only one SPF TXT per domain is allowed by RFC):
```
"v=spf1 include:_spf.resend.com include:_spf.google.com ~all"
```

### DKIM (three CNAMEs from Resend)
Resend's dashboard gives you the exact three records. Paste each
into Cloudflare DNS as CNAME pointing to the Resend-supplied
target. **Do not "proxy" through Cloudflare** — DKIM CNAMEs must
be DNS-only (gray cloud icon, not orange).

### DMARC (one TXT record on `_dmarc.korehani.com`)
Start in monitor mode while you verify alignment:
```
_dmarc.korehani.com.    TXT    "v=DMARC1; p=none; rua=mailto:dmarc@korehani.com; ruf=mailto:dmarc@korehani.com; fo=1"
```

After two weeks of clean reports, tighten to:
```
"v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@korehani.com"
```

Then ramp `pct` to 50, then 100, then upgrade `p` to `reject`.

> 💡 Cloudflare also offers a free DMARC report aggregator
> (`Cloudflare DMARC Management`). Pointing `rua` there means
> you don't have to monitor an inbox.

---

## 3. Resend webhook

The audit shipped `supabase/functions/resend-webhook` (EMAIL-F3). To
activate it:

1. `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...` (the
   value comes from Resend dashboard → Webhooks → Add Endpoint).
2. `supabase functions deploy resend-webhook --no-verify-jwt`
   (the `--no-verify-jwt` flag is required because Resend signs
   with its own Svix signature, not a Supabase JWT).
3. In Resend dashboard, Add Endpoint:
   `https://<project>.supabase.co/functions/v1/resend-webhook`
4. Subscribe to:
   - `email.bounced` (hard bounces → suppress)
   - `email.complained` (spam-mark → critical-log + suppress)
   - `email.delivery_delayed` (optional — observability only)
5. Send a test event from Resend's webhook tester. Confirm a
   row appears in `client_errors` with severity `warn`.

---

## 4. RESEND_API_KEY in env (EMAIL-F9)

The current setup falls back to `app_settings.resend_key` (DB
column). That's readable by anyone with admin-CMS access.
Prefer env var:

```
supabase secrets set RESEND_API_KEY=re_<your-key>
```

After setting, the Edge Function's `getResendKey` prefers env
first. Eventually delete the `app_settings.resend_key` row and
remove the fallback from `newsletter-send/index.ts:69`.

---

## 5. Smoke-test checklist (after DNS verified)

Run one-by-one and confirm each lands in INBOX (not spam):

- [ ] Sign up a fresh test account → confirm email arrives within
      30s and lands in Gmail inbox.
- [ ] Click confirm link → page redirects with success state.
- [ ] Reset password from the auth page → reset email arrives.
- [ ] Subscribe to newsletter → confirm email arrives, **Korean**
      template if locale is `ko`, English otherwise.
- [ ] Open Gmail's "show original" on a confirm email → expect:
      - `SPF: PASS`
      - `DKIM: PASS with domain korehani.com`
      - `DMARC: PASS`
- [ ] Send a campaign test (admin newsletter editor → 테스트 발송).
      Verify the preheader text shows up in Gmail's inbox preview
      (not the logo alt).
- [ ] Mark one test email as spam in Gmail → wait 5 min → check
      `client_errors` table has a row with severity `critical`
      and `source: resend-webhook` AND `newsletter_subs` for that
      address has `status='bounced'`.
- [ ] Click the one-click unsubscribe header in Gmail (three-dot
      menu → Unsubscribe) → wait → `newsletter_subs.status =
      'unsubscribed'`.

---

## 6. Ongoing monitoring

- Resend dashboard → "Reputation" panel: keep bounce rate <1%,
  complaint rate <0.1%.
- DMARC reports (rua mailbox or Cloudflare DMARC Management):
  watch for unauthorized senders + alignment failures.
- `client_errors` with `source='resend-webhook'`: any spike =
  reputation incident or template change rejected.
