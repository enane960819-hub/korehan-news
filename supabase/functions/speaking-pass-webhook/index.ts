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
// 'critical' fires the future Discord webhook (AN-F2 follow-up).
async function logServerError(
  sb: SupabaseClient,
  message: string,
  context: Record<string, unknown>,
  severity: 'warn' | 'error' | 'critical' = 'critical',
): Promise<void> {
  try {
    await sb.from('client_errors').insert({
      message: message.slice(0, 500),
      context: { ...context, source: 'speaking-pass-webhook' },
      url:      null,
      user_agent: 'edge-function/speaking-pass-webhook',
      severity,
    });
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
