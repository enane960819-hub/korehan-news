// ══════════════════════════════════════════════════════════════════════
// speaking-pass-webhook — Stripe `checkout.session.completed` handler
// for Speaking Coach coin top-ups. Grants `coins` to the user wallet
// via the service-role RPC `grant_speaking_coins`.
//
// Deploy with `--no-verify-jwt` (Stripe signs the payload, we verify
// the Stripe-Signature header manually).
//
// ── Secrets ──────────────────────────────────────────────────────────
//   STRIPE_SECRET_KEY            sk_...
//   STRIPE_WEBHOOK_SECRET        whsec_...
//   SUPABASE_SERVICE_ROLE_KEY    (auto-injected)
//   SUPABASE_URL                 (auto-injected)
//
// Stripe dashboard endpoint events: `checkout.session.completed`.
// ══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// PAY-F6: Persist webhook errors to public.client_errors so they survive
// past the Supabase log retention window (1-7 days). Severity follows
// the column added in 20260526_audit_7_client_errors_severity.sql —
// 'critical' fires the Discord webhook via AN-F2's notify-critical-error
// Edge Function.
async function logServerError(
  sb: SupabaseClient,
  message: string,
  context: Record<string, unknown>,
  severity: 'warn' | 'error' | 'critical' = 'critical',
): Promise<void> {
  try {
    const { data, error } = await sb.from('client_errors')
      .insert({
        message: message.slice(0, 500),
        context: { ...context, source: 'speaking-pass-webhook' },
        url:      null,
        user_agent: 'edge-function/speaking-pass-webhook',
        severity,
      })
      .select('id')
      .single();
    if (error || !data?.id) return;
    if (severity !== 'critical') return;
    // Fire-and-forget — same Edge Function the frontend calls. We
    // do NOT await it; the webhook should return to Stripe quickly
    // and a stalled Discord webhook shouldn't extend our latency.
    const supaUrl  = Deno.env.get('SUPABASE_URL') || '';
    const supaKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supaUrl) return;
    try {
      void fetch(`${supaUrl}/functions/v1/notify-critical-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Edge-function-to-edge-function calls need an Authorization
          // header. The service-role key bypasses RLS / JWT checks.
          'Authorization': `Bearer ${supaKey}`,
        },
        body: JSON.stringify({ id: data.id }),
      }).catch(() => {});
    } catch (_) { /* swallow */ }
  } catch (_) {
    // logging-of-logging failure swallowed — last-ditch
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // PAY-F6: instantiate the service-role client early so failure paths
  // can persist diagnostics to client_errors instead of relying on
  // Supabase log retention.
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    await logServerError(sb, 'missing stripe-signature header', {
      method: req.method,
      ip: req.headers.get('x-forwarded-for') || null,
    });
    return new Response('missing stripe-signature', { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (e) {
    console.error('[speaking-pass-webhook] signature verification failed', e);
    await logServerError(sb, 'stripe signature verification failed', {
      error: e instanceof Error ? e.message : String(e),
      ip: req.headers.get('x-forwarded-for') || null,
    });
    return new Response('invalid signature', { status: 400 });
  }

  // PAY-F1: refund + dispute branches. We dispatch on event.type
  // before falling through to the legacy 'checkout.session.completed'
  // path. Every branch returns 200 on success so Stripe doesn't retry.
  if (event.type === 'charge.refunded') {
    return await handleChargeRefunded(sb, event);
  }
  if (event.type === 'charge.dispute.created') {
    // Chargebacks: customer initiated, money hasn't moved yet. Log
    // critical so the operator can review before it auto-loses (and
    // converts to a charge.refunded later). Do NOT revoke coins here
    // — that fires on the refunded event.
    const dispute = event.data.object as Stripe.Dispute;
    await logServerError(sb, 'chargeback dispute opened', {
      dispute_id: dispute.id,
      charge_id:  dispute.charge,
      amount:     dispute.amount,
      currency:   dispute.currency,
      reason:     dispute.reason,
      status:     dispute.status,
    });
    return new Response(
      JSON.stringify({ ok: true, dispute_logged: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (event.type === 'payment_intent.canceled') {
    // Pre-completion cancel — we never granted coins so nothing to
    // revoke. Ignore quietly.
    return new Response('ignored: payment canceled pre-grant', { status: 200 });
  }
  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.product !== 'speaking-coach-coins') {
    return new Response('not our product', { status: 200 });
  }
  if (session.payment_status !== 'paid') {
    return new Response('not paid', { status: 200 });
  }

  const user_id = session.metadata?.user_id;
  const coins   = parseInt(session.metadata?.coins || '0', 10);
  const amount  = session.amount_total ?? 0;

  if (!user_id || !Number.isFinite(coins) || coins <= 0) {
    console.error('[speaking-pass-webhook] missing/invalid metadata', session.metadata);
    await logServerError(sb, 'webhook metadata missing/invalid', {
      session_id: session.id,
      metadata: session.metadata,
    });
    return new Response('missing metadata', { status: 400 });
  }

  const { data, error } = await sb.rpc('grant_speaking_coins', {
    p_user_id:           user_id,
    p_coins:             coins,
    p_amount_cents:      amount,
    p_stripe_session_id: session.id,
  });

  if (error) {
    // PAY-F3: when the auth.users row has been deleted, the RPC's
    // INSERT INTO speaking_coin_purchases (FK to auth.users) fails
    // with PostgREST code 23503 (foreign_key_violation). Returning
    // 500 makes Stripe retry for 3 days, then dead-letter — money
    // was captured but never reconciled. Instead, return 200 (don't
    // retry) AND persist a critical row so the operator can refund
    // or hand-grant.
    const code = (error as { code?: string }).code;
    const isOrphanedUser =
      code === '23503' ||
      /foreign key|violates foreign key constraint/i.test(error.message || '');
    if (isOrphanedUser) {
      console.error('[speaking-pass-webhook] payment for deleted user', {
        user_id, session_id: session.id, amount, coins,
      });
      await logServerError(sb, 'payment received for deleted user', {
        user_id, session_id: session.id, amount, coins,
        action_required: 'refund or hand-grant after restoring user',
      });
      return new Response(
        JSON.stringify({ ok: false, orphaned: true, action: 'manual_reconcile' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    console.error('[speaking-pass-webhook] grant error', error);
    await logServerError(sb, 'grant_speaking_coins RPC failed', {
      session_id: session.id, user_id, coins,
      error_code: code || null,
      error_msg:  error.message,
    });
    return new Response('rpc error: ' + error.message, { status: 500 });
  }

  // Idempotency hardening (audit F5). Stripe retries
  // checkout.session.completed for up to 3 days; the RPC's UNIQUE
  // constraint on stripe_session_id is the only thing stopping each
  // retry from re-granting coins. Detect "already_granted" replies
  // (RPC contract: data = { ok:true, reason?:'duplicate'|'ok',
  // granted_coins:N, balance:N }) and log them as warnings rather
  // than silent success — so an operator can spot a runaway retry
  // loop or a constraint that got dropped. Defensive: tolerate the
  // RPC returning a bare integer / null too (older deploys).
  const grantInfo = data as
    | { ok?: boolean; reason?: string; granted_coins?: number; balance?: number }
    | number
    | null;
  const reason = grantInfo && typeof grantInfo === 'object' ? grantInfo.reason : null;
  if (reason === 'duplicate' || reason === 'already_granted') {
    console.warn('[speaking-pass-webhook] duplicate webhook (idempotent skip)', {
      user_id, session_id: session.id, coins,
    });
  } else {
    console.log('[speaking-pass-webhook] granted', { user_id, coins, data });
  }
  return new Response(JSON.stringify({ ok: true, grant: data, idempotent: reason === 'duplicate' || reason === 'already_granted' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

// ─── PAY-F1: refund handler ───────────────────────────────────────────
// Stripe fires `charge.refunded` for both full and partial refunds.
// The Charge object carries `payment_intent`; we look up the originating
// Checkout Session via Stripe API, then call revoke_speaking_coins.
//
// Always 200 on completion (success OR "no matching purchase" OR
// "user already spent coins") — we don't want Stripe to retry, the
// reconciliation lives in client_errors and operator review.
async function handleChargeRefunded(
  sb: SupabaseClient,
  event: Stripe.Event,
): Promise<Response> {
  const charge = event.data.object as Stripe.Charge;

  // The Charge → Checkout Session mapping isn't direct. Two paths:
  //   1. The most recent refund object on the charge tells us the
  //      amount + refund event id we care about for this delivery.
  //   2. `charge.payment_intent` lets us list sessions to find ours.
  const refunds = charge.refunds?.data ?? [];
  if (!refunds.length) {
    await logServerError(sb, 'charge.refunded event with no refunds[]', {
      charge_id: charge.id, payment_intent: charge.payment_intent,
    });
    return new Response('no refunds in event', { status: 200 });
  }
  // The refund this delivery is announcing is the newest one (others,
  // if any, were announced on their own deliveries — Stripe sends one
  // event per refund operation).
  const refund = refunds[refunds.length - 1];

  // Look up the originating Checkout Session.
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) {
    await logServerError(sb, 'charge.refunded has no payment_intent', {
      charge_id: charge.id, refund_id: refund.id,
    });
    return new Response('no payment_intent', { status: 200 });
  }

  let sessionId: string | null = null;
  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    sessionId = sessions.data[0]?.id ?? null;
  } catch (e) {
    await logServerError(sb, 'failed to look up session for refund', {
      charge_id: charge.id, refund_id: refund.id,
      payment_intent: paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
    // 500 so Stripe retries — the lookup might transient-fail.
    return new Response('session lookup failed', { status: 500 });
  }
  if (!sessionId) {
    // Not a Checkout-session payment — refunds on subscription invoices,
    // direct charges via Payment Intents API, etc. don't have a
    // session. Not our path.
    return new Response('not a checkout session refund', { status: 200 });
  }

  const { data: revokeResult, error: revokeError } = await sb.rpc(
    'revoke_speaking_coins',
    {
      p_stripe_session_id:      sessionId,
      p_stripe_refund_event_id: refund.id,
      p_refund_amount_cents:    refund.amount,
      p_refund_reason:          refund.reason || 'stripe_refund',
    },
  );

  if (revokeError) {
    await logServerError(sb, 'revoke_speaking_coins RPC failed', {
      session_id: sessionId, refund_id: refund.id,
      charge_id: charge.id,
      error_code: (revokeError as { code?: string }).code || null,
      error_msg:  revokeError.message,
    });
    // 500 → Stripe retries up to 3 days. Acceptable because by the
    // time we're here Stripe has already refunded the money, so
    // re-processing the same refund_event_id is safe (idempotent
    // RPC). Operator alert via the critical client_errors row.
    return new Response('revoke error: ' + revokeError.message, { status: 500 });
  }

  const result = revokeResult as {
    ok?: boolean;
    no_grant?: boolean;
    already_processed?: boolean;
    coins_revoked?: number;
    shortfall?: number;
    purchase_id?: number;
    user_id?: string;
  } | null;

  if (result?.no_grant) {
    // The refund came in but we never recorded the grant — either
    // the grant webhook is still pending, or this refund is for a
    // session we don't own.
    await logServerError(
      sb,
      'refund webhook for unknown purchase',
      { session_id: sessionId, refund_id: refund.id, charge_id: charge.id },
      'warn',
    );
    return new Response(JSON.stringify({ ok: true, no_grant: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  // Shortfall = coins we wanted to claw back but couldn't (user
  // already consumed them). Logged as critical because it's direct
  // revenue loss the operator may want to reconcile (e.g. via a
  // future Stripe customer-balance adjustment).
  if ((result?.shortfall ?? 0) > 0) {
    await logServerError(sb, 'refund shortfall — user already spent coins', {
      purchase_id:    result?.purchase_id,
      user_id:        result?.user_id,
      session_id:     sessionId,
      refund_id:      refund.id,
      coins_revoked:  result?.coins_revoked,
      shortfall:      result?.shortfall,
      refund_reason:  refund.reason,
      action_required: `refund issued but ${result?.shortfall} of ${(result?.coins_revoked ?? 0) + (result?.shortfall ?? 0)} coins were already consumed — net loss`,
    });
  } else {
    console.log('[speaking-pass-webhook] refund processed', {
      session_id: sessionId, refund_id: refund.id,
      coins_revoked: result?.coins_revoked,
    });
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}
