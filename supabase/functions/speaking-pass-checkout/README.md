# Speaking Coach — Daily Pass Setup

End-to-end steps to wire up the $1/$3 daily coach pass for Pro users.

---

## 1. Run the SQL migration

Supabase dashboard → **SQL Editor** → paste and run:

```
supabase/migrations/20260421_speaking_coach_daily_pass.sql
```

This creates:

- `speaking_coach_passes` table (one pass per user per KST day)
- `get_speaking_pass_status(level)` — RPC for the UI badge
- `consume_speaking_coin(level)` — atomic decrement at submit time
- `create_speaking_pass(...)` — service-role RPC called by the webhook

It also drops the old v1 free-quota RPCs. The `user_speaking_coins`
table from v1 is left in place (no longer used for gating, kept for
lifetime-submit analytics).

---

## 2. Create the two Stripe products

**Stripe dashboard → Products → Add product.**

| Name                           | Price     | Currency | Type       |
|--------------------------------|-----------|----------|------------|
| Speaking Coach Pass — Seed/Sprout | **$1**  | USD      | One-time   |
| Speaking Coach Pass — Tree        | **$3**  | USD      | One-time   |

Open each product, click the price row, and copy its **Price ID**
(`price_…`). You'll paste these into Supabase secrets below.

---

## 3. Set Supabase Edge Function secrets

**Supabase dashboard → Project settings → Edge Functions → Secrets.**

| Secret                      | Value                                      |
|-----------------------------|--------------------------------------------|
| `STRIPE_SECRET_KEY`         | `sk_test_…` (test) or `sk_live_…` (prod)   |
| `STRIPE_WEBHOOK_SECRET`     | `whsec_…` (set after step 5)               |
| `STRIPE_PRICE_SEED_SPROUT`  | `price_…` from the $1 product              |
| `STRIPE_PRICE_TREE`         | `price_…` from the $3 product              |
| `APP_BASE_URL`              | `https://korehannews.com` (or your domain) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically.

---

## 4. Deploy the Edge Functions

From the repo root:

```bash
supabase functions deploy speaking-pass-checkout
supabase functions deploy speaking-pass-webhook --no-verify-jwt
```

The webhook MUST be deployed with `--no-verify-jwt` because Stripe does
not send a Supabase JWT — the function verifies the Stripe signature
header instead.

---

## 5. Register the webhook in Stripe

Stripe dashboard → **Developers → Webhooks → Add endpoint**.

- **Endpoint URL**: `https://<your-project-ref>.functions.supabase.co/speaking-pass-webhook`
- **Events**: `checkout.session.completed`

Click the endpoint after creating, reveal the **signing secret**
(`whsec_…`), and paste it into the `STRIPE_WEBHOOK_SECRET` Supabase
secret from step 3. Redeploy the webhook function after updating the
secret so the new value is picked up.

---

## 6. End-to-end test (Stripe test mode)

1. Use a card like `4242 4242 4242 4242`, any future expiry, any CVC.
2. Log into the app as a user whose `user_subscriptions.plan = 'pro'`
   and `status = 'active'` (toggle via the admin user-management page).
3. Open the writing modal → Speaking section → tap the `💳 Buy today's
   coach pass · $1` badge.
4. Complete Stripe Checkout.
5. You should be redirected back to the Study Room with `?coach_pass=ok`;
   the badge flips to `🪙 Today's pass · 5 / 5 coins`.
6. Record + click **Send to Human Coach** → coin decrements to 4.
7. In the admin `🎙️ Speaking Reviews` page you should see the pending
   submission. Write feedback, click **Send to user** → status flips to
   `admin_approved` and the user sees it in the Writing Feedback inbox.

---

## 7. Going live

- Replace `sk_test_…` / `whsec_…` / `price_…` with live values.
- Update the Stripe webhook endpoint to the live signing secret.
- Everything else is identical.

---

## Runtime gates (defence in depth)

- `user_subscriptions.plan = 'pro'` — checked in the checkout Edge
  Function BEFORE creating the Stripe session, and in the client via
  `requirePlan('speaking_feedback')`.
- `create_speaking_pass` — RPC refuses to run unless the caller's JWT
  role is `service_role` (Edge Function uses the service key).
- `consume_speaking_coin` — row-level lock on the active pass row;
  cannot over-consume even under concurrent submissions.
- `speaking_coach_passes.stripe_session_id` is `UNIQUE`, so a replayed
  webhook cannot double-grant.
