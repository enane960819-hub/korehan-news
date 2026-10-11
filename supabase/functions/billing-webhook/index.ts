// billing-webhook — Stripe → user_subscriptions for KoreHani Premium.
//
// Registered automatically by `billing` (action: setup), which also stores
// the signing secret in app_settings 'stripe_billing_webhook_secret'.
// Gateway JWT check is off (config.toml); every request must carry a valid
// Stripe-Signature.
//
// Mapping (one row per user, UNIQUE user_id):
//   trialing / active / past_due  → plan 'premium', status 'active',
//                                   expires_at = current_period_end (+1 day grace)
//   canceled / unpaid / incomplete_expired → status 'expired'
//   cancel_at_period_end mirrors Stripe; trial_used flips true once trialing.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRACE_MS = 24 * 3600 * 1000

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

  async function syncSubscription(sub: Stripe.Subscription) {
    const userId = await userIdFor(sub)
    if (!userId) { await logErr('subscription without user', { sub: sub.id }); return }
    const live = ['trialing', 'active', 'past_due'].includes(sub.status)
    const { data: prev } = await sb.from('user_subscriptions').select('trial_used').eq('user_id', userId).maybeSingle()
    const row = {
      user_id: userId,
      plan: 'premium',
      status: live ? 'active' : 'expired',
      expires_at: new Date(sub.current_period_end * 1000 + GRACE_MS).toISOString(),
      payment_provider: 'stripe',
      payment_id: sub.id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      trial_used: !!prev?.trial_used || sub.status === 'trialing' || !!sub.trial_start,
      updated_at: new Date().toISOString(),
    }
    const { error } = await sb.from('user_subscriptions').upsert(row, { onConflict: 'user_id' })
    if (error) throw new Error('upsert: ' + error.message)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        if (s.mode === 'subscription' && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(s.subscription))
          if (!sub.metadata?.user_id && s.client_reference_id) sub.metadata = { ...sub.metadata, user_id: s.client_reference_id }
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription)
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
