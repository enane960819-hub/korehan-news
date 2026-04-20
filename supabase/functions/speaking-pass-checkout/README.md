# Speaking Coach — Coin Wallet Setup

End-to-end steps to wire up the $1-per-coin human coach review wallet
for Pro users.

**Model (v3):**
- 1 coin = $1 = 1 submission to a human coach
- Minimum purchase 5 coins ($5), max 200
- Coins persist in the user's wallet (no daily expiry)
- Level still controls char cap:
  - Seed/Sprout → 250 char cap
  - Tree → 500 char cap
  - Forest → Not sold (1:1 tutoring upsell)

---

## 1. Run the SQL migration

Supabase dashboard → **SQL Editor** → paste and run:

```
supabase/migrations/20260422_speaking_coach_wallet.sql
```

This creates:

- `user_speaking_coins` (persistent wallet: `coins_remaining`,
  `total_purchased`, `total_submitted`)
- `speaking_coin_purchases` (Stripe checkout history with UNIQUE
  constraint on `stripe_session_id` for idempotency)
- `get_speaking_wallet_status(level)` — RPC for the UI badge
- `consume_speaking_coin(level)` — atomic decrement at submit time
- `grant_speaking_coins(...)` — service-role RPC called by the webhook

It drops the v2 pass RPCs but does NOT delete the `speaking_coach_passes`
table — left for historical audit.

---

## 2. Create ONE Stripe product — `Coach Coin`

**Stripe dashboard → Products → Add product.**

| Name         | Price | Currency | Type     |
|--------------|-------|----------|----------|
| Coach Coin   | **$1** | USD     | One-time |

Open the product, click the price row, copy the **Price ID** (`price_…`).

> Why just one? The checkout Edge Function uses Stripe's line-item
> `quantity` field to scale, so `qty=5` charges $5, `qty=20` charges $20.
> One price → any pack size with zero extra Stripe config.

---

## 3. Set Supabase Edge Function secrets

**Supabase dashboard → Project settings → Edge Functions → Secrets.**

| Secret                      | Value                                      |
|-----------------------------|--------------------------------------------|
| `STRIPE_SECRET_KEY`         | `sk_test_…` (test) or `sk_live_…` (prod)   |
| `STRIPE_WEBHOOK_SECRET`     | `whsec_…` (set after step 5)               |
| `STRIPE_PRICE_COACH_COIN`   | `price_…` from the $1 product              |
| `APP_BASE_URL`              | `https://korehannews.com` (or your domain) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically by Supabase.

---

## 4. Deploy the Edge Functions

From the repo root:

```bash
supabase functions deploy speaking-pass-checkout
supabase functions deploy speaking-pass-webhook --no-verify-jwt
```

The webhook MUST use `--no-verify-jwt` because Stripe does not send a
Supabase JWT — the function verifies the `Stripe-Signature` header
itself.

---

## 5. Register the webhook in Stripe

Stripe dashboard → **Developers → Webhooks → Add endpoint**.

- **Endpoint URL**: `https://<your-project-ref>.functions.supabase.co/speaking-pass-webhook`
- **Events**: `checkout.session.completed`

Reveal the **signing secret** (`whsec_…`), paste it into the
`STRIPE_WEBHOOK_SECRET` secret from step 3, and **redeploy** the
webhook function so the new value is picked up.

---

## 6. End-to-end test (Stripe test mode)

1. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.
2. Log in as a user with `user_subscriptions.plan = 'pro'` (toggle via
   admin user-management if needed).
3. Open Study Room → Writing modal → Speaking section → tap the badge
   (`💳 Buy coach coins · $1 / coin`) → the purchase modal opens.
4. Pick a pack (5, 10, or 20 coins) → complete Stripe Checkout.
5. Redirect back to Study Room with `?coach_coins=ok`. Badge flips to
   green: `🪙 5 coach coins · +buy`.
6. Record + **Send to Human Coach** → balance decrements by 1.
7. Admin `🎙️ Speaking Reviews` page shows the pending submission.
   Write feedback → **Send to user** → user sees it in the Writing
   Feedback inbox.

---

## 7. Going live

- Swap `sk_test_…` → `sk_live_…`
- Create the product in live mode and update `STRIPE_PRICE_COACH_COIN`
- Re-register the webhook for live mode, update
  `STRIPE_WEBHOOK_SECRET`, redeploy the webhook function.

---

## Defence-in-depth recap

| Control | Where |
|---|---|
| Pro-only purchase | `requirePlan('speaking_feedback')` FE + `user_subscriptions` check in Edge Function |
| Min/max coins enforced | Checkout Edge Function (`MIN_COINS=5`, `MAX_COINS=200`) |
| Wallet writes | `grant_speaking_coins` refuses unless JWT role is `service_role` (webhook only) |
| Idempotent grants | `speaking_coin_purchases.stripe_session_id UNIQUE` — replayed webhooks no-op |
| No over-consume | `consume_speaking_coin` uses `FOR UPDATE` row lock |
| Forest never sold | `_speaking_level_meta('Advanced').sellable = false` + FE redirect modal |
