// billing-webhook — Stripe → user_subscriptions for KoreHani Premium / Premium Live.
//
// Registered automatically by `billing` (action: setup), which also stores
// the signing secret in app_settings 'stripe_billing_webhook_secret'.
// Gateway JWT check is off (config.toml); every request must carry a valid
// Stripe-Signature.
//
// Mapping (one row per user, UNIQUE user_id):
//   plan                          → 'premium_live' when any subscription item's
//                                   price has lookup_key 'kh_premium_live_month'
//                                   (Premium Live, $27.99/mo, owner 2026-10-29),
//                                   otherwise 'premium'
//   trialing / active             → status 'active',
//                                   expires_at = current_period_end (+1 day grace)
//   past_due                      → still 'active', but expires_at is capped at
//                                   max(previous expires_at, now + 3 days)
//   canceled / unpaid / incomplete_expired → status 'expired'
//   cancel_at_period_end mirrors Stripe; trial_used flips true once trialing.
// The subscription is always re-fetched from Stripe (payload not trusted).
// A non-live event for a subscription other than the stored payment_id never
// downgrades a currently live row. Deleted users (FK 23503) are acked with 200.
//
// Legacy Weekend Live Class seats ($5 one-time payments, metadata.product
// 'kh-live-class', sold until 2026-10-29 — Premium Live seats are included in
// the plan and booked by billing 'live_reserve' without Stripe). Kept so
// checkouts still open at the switch and later refunds resolve correctly:
//   checkout.session.completed (paid) → weekly_live_registrations status 'paid'
//   checkout.session.expired          → the pending seat hold is freed
//   charge.refunded                   → status 'refunded' (refunds made in Stripe too)

//
// Special shop (digital items, owner 2026-10-31; metadata.kind 'kh-cash'):
//   checkout.session.completed (paid) → kh_grant_cash_order(order_id): items into
//                                       user_room_state.owned / user_photocards
//   checkout.session.expired          → the pending order is marked canceled
//   charge.refunded (full refund)     → kh_revoke_cash_order(): takes back what it added

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRACE_MS = 24 * 3600 * 1000
const PAST_DUE_GRACE_MS = 3 * 24 * 3600 * 1000
const LIVE_PLAN_LOOKUP_KEY = 'kh_premium_live_month'   // = billing LIVE_PLAN_PRICE.lookup_key

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const logErr = (message: string, context: Record<string, unknown> = {}) =>
    sb.from('client_errors').insert({
      message: 'billing-webhook: ' + message.slice(0, 400), severity: 'critical',
      context: { source: 'billing-webhook', ...context }, user_agent: 'edge-function',
    }).then(() => {}, () => {})

  const { data: settings } = await sb.from('app_settings').select('key,value')
    .in('key', ['stripe_secret_key', 'stripe_billing_webhook_secret'])
  const conf: Record<string, string> = {}
  for (const r of settings || []) conf[r.key] = String(r.value || '')
  const apiKey = conf.stripe_secret_key || Deno.env.get('STRIPE_SECRET_KEY') || ''
  const whSecret = conf.stripe_billing_webhook_secret || Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET') || ''
  if (!apiKey || !whSecret) {
    await logErr('billing not configured (missing key or webhook secret)')
    return new Response('not configured', { status: 503 })
  }
  const stripe = new Stripe(apiKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

  const sig = req.headers.get('stripe-signature') || ''
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret)
  } catch (e) {
    await logErr('signature verification failed', { error: String((e as Error)?.message || e) })
    return new Response('invalid signature', { status: 400 })
  }

  async function userIdFor(sub: Stripe.Subscription): Promise<string | null> {
    if (sub.metadata?.user_id) return sub.metadata.user_id
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (!customerId) return null
    const { data } = await sb.from('user_subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle()
    if (data?.user_id) return data.user_id
    const cust = await stripe.customers.retrieve(customerId).catch(() => null) as any
    return cust?.metadata?.user_id || null
  }

  // Never trust the event payload: events can arrive out of order or be
  // retried hours later, so always re-read the subscription from Stripe.
  async function syncSubscription(subId: string, userIdHint: string | null = null) {
    const sub = await stripe.subscriptions.retrieve(subId)
    if (!sub.metadata?.user_id && userIdHint) sub.metadata = { ...sub.metadata, user_id: userIdHint }
    const userId = await userIdFor(sub)
    if (!userId) { await logErr('subscription without user', { sub: sub.id }); return }
    const live = ['trialing', 'active', 'past_due'].includes(sub.status)
    const { data: prev } = await sb.from('user_subscriptions')
      .select('plan,status,expires_at,payment_id,trial_used').eq('user_id', userId).maybeSingle()
    const now = Date.now()
    const prevExp = prev?.expires_at ? new Date(prev.expires_at).getTime() : null
    const prevLive = !!prev && prev.status === 'active' && ['premium', 'premium_live', 'standard', 'pro'].includes(prev.plan) &&
      prevExp !== null && prevExp > now
    // A different (stale) subscription ending must not downgrade a user whose
    // current access comes from another live subscription / grant.
    if (prev && prev.payment_id !== sub.id && prevLive && !live) {
      console.log('[billing-webhook] skip: non-live sub', sub.id, 'differs from current', prev.payment_id)
      return
    }
    let expiresMs = sub.current_period_end * 1000 + GRACE_MS
    if (sub.status === 'past_due') {
      // Keep Premium while Stripe retries the card, but never extend access
      // on an unpaid invoice: cap at max(previous expiry, now + 3 days).
      const cap = Math.max(prevExp ?? 0, now + PAST_DUE_GRACE_MS)
      expiresMs = Math.min(expiresMs, cap)
    }
    // Subscription items carry the full Price object (lookup_key included).
    const plan = sub.items.data.some((it: Stripe.SubscriptionItem) => it.price?.lookup_key === LIVE_PLAN_LOOKUP_KEY)
      ? 'premium_live' : 'premium'
    const row = {
      user_id: userId,
      plan,
      status: live ? 'active' : 'expired',
      expires_at: new Date(expiresMs).toISOString(),
      payment_provider: 'stripe',
      payment_id: sub.id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      trial_used: !!prev?.trial_used || sub.status === 'trialing' || !!sub.trial_start,
      updated_at: new Date().toISOString(),
    }
    const { error } = await sb.from('user_subscriptions').upsert(row, { onConflict: 'user_id' })
    if (error) {
      if (error.code === '23503') {
        // FK violation: the user was deleted. Retrying can never succeed, so
        // log it and acknowledge the event (no retry storm).
        await logErr('user no longer exists; event ignored', { sub: sub.id, user_id: userId })
        return
      }
      throw new Error('upsert: ' + error.message)
    }
  }

  // Live class seat paid — re-read the session from Stripe (payload not trusted).
  async function liveSeatPaid(id: string) {
    const s = await stripe.checkout.sessions.retrieve(id)
    if (s.payment_status !== 'paid') return
    const userId = s.metadata?.user_id || s.client_reference_id
    const liveId = s.metadata?.live_session_id
    if (!userId || !liveId) { await logErr('live seat without user/session', { checkout: s.id }); return }
    const { error } = await sb.from('weekly_live_registrations').upsert({
      session_id: liveId, user_id: userId, status: 'paid', paid_at: new Date().toISOString(), hold_until: null,
      amount_cents: s.amount_total, stripe_session_id: s.id,
      stripe_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id,
      email: s.customer_details?.email || null,
    }, { onConflict: 'session_id,user_id' })
    if (error && error.code !== '23503') throw new Error('live upsert: ' + error.message)
  }

  // Special shop order paid — re-read the session from Stripe (payload not trusted).
  async function cashOrderPaid(id: string) {
    const s = await stripe.checkout.sessions.retrieve(id)
    if (s.payment_status !== 'paid') return
    const orderId = s.metadata?.order_id
    if (!orderId) { await logErr('cash order without order_id', { checkout: s.id }); return }
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id
    await sb.from('cash_orders').update({ stripe_session_id: s.id, stripe_payment_intent: pi || null }).eq('id', orderId)
    const { data, error } = await sb.rpc('kh_grant_cash_order', { p_order: orderId })
    if (error) throw new Error('grant: ' + error.message)
    if (!data?.ok) await logErr('cash order not granted', { order: orderId, result: data })
  }

  try {
    switch (event.type) {
      case 'checkout.session.expired': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.metadata?.product === 'kh-live-class') {
          await sb.from('weekly_live_registrations').delete().eq('stripe_session_id', s.id).eq('status', 'pending')
        }
        if (s.metadata?.kind === 'kh-cash') {
          await sb.from('cash_orders').update({ status: 'canceled' }).eq('stripe_session_id', s.id).eq('status', 'pending')
        }
        break
      }
      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge
        const pi = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id
        if (pi && ch.refunded) {
          await sb.from('weekly_live_registrations').update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('stripe_payment_intent', pi).eq('status', 'paid')
          const { data: co } = await sb.from('cash_orders').select('id').eq('stripe_payment_intent', pi).eq('status', 'paid')
          for (const o of co || []) {
            const { error } = await sb.rpc('kh_revoke_cash_order', { p_order: o.id })
            if (error) throw new Error('revoke: ' + error.message)
          }
        }
        break
      }
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.mode === 'payment' && s.metadata?.product === 'kh-live-class') {
          await liveSeatPaid(s.id)
        } else if (s.mode === 'payment' && s.metadata?.kind === 'kh-cash') {
          await cashOrderPaid(s.id)
        } else if (s.mode === 'subscription' && s.subscription) {
          await syncSubscription(String(s.subscription), s.client_reference_id || null)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription((event.data.object as Stripe.Subscription).id)
        break
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        await logErr('payment failed', { invoice: inv.id, customer: inv.customer })
        break
      }
    }
  } catch (e) {
    await logErr('handler failed', { type: event.type, error: String((e as Error)?.message || e) })
    return new Response('handler error', { status: 500 }) // Stripe retries
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
