// billing — KoreHani Premium subscriptions (Stripe).
//
// Actions (POST JSON { action, ... }):
//   checkout { interval: 'month'|'year' }  signed-in user → Stripe Checkout URL
//                                          (no free trial — owner, 2026-10-28)
//   portal                                 signed-in user → Stripe Billing Portal URL
//                                          (cancel, change card, invoices)
//   setup                                  admin only → ensures the Premium product,
//                                          both prices and the webhook endpoint exist;
//                                          stores the webhook signing secret
//   status                                 admin only → what is configured
//   live_checkout { session_id }           Premium member → Stripe Checkout URL for one
//                                          Weekend Live Class seat ($5, 8 seats; the seat
//                                          is held as 'pending' while checkout is open)
//   live_cancel { session_id }             paid seat, 24 h+ before class → full refund
//
// The Stripe secret key comes from app_settings 'stripe_secret_key' (saved from
// the admin CMS → Settings) or the STRIPE_SECRET_KEY function secret. Prices are
// found by lookup_key, so nothing else has to be configured by hand.
// user_subscriptions is written only by billing-webhook (source of truth = Stripe).

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://korehani.com'
// No free trial: a new account would get it again (owner, 2026-10-28).
const TRIAL_DAYS = 0
export const PRICES = {
  month: { lookup_key: 'kh_premium_month', unit_amount: 899, interval: 'month' as const, nickname: 'Premium monthly' },
  year:  { lookup_key: 'kh_premium_year',  unit_amount: 6900, interval: 'year' as const,  nickname: 'Premium annual' },
}
// Weekend Live Class seat — one-time payment (owner, 2026-10-28).
export const LIVE_PRICE = { lookup_key: 'kh_live_class', unit_amount: 500, nickname: 'Live class seat' }
const LIVE_HOLD_MS = 31 * 60 * 1000          // Stripe Checkout minimum lifetime is 30 min
const LIVE_REFUND_MS = 24 * 3600 * 1000      // cancel up to 24 h before = full refund
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.expired',
  'charge.refunded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

let corsHeaders: Record<string, string> = {}
function setCors(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ['https://korehani.com', 'https://www.korehani.com', 'https://korehannews.com', 'https://www.korehannews.com', 'http://localhost:3000', 'http://localhost:8888']
  corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

async function stripeClient(sb: any): Promise<{ stripe: Stripe; live: boolean } | null> {
  const { data } = await sb.from('app_settings').select('value').eq('key', 'stripe_secret_key').maybeSingle()
  const key = String(data?.value || Deno.env.get('STRIPE_SECRET_KEY') || '').trim()
  if (!key) return null
  return { stripe: new Stripe(key, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() }), live: /_live_/.test(key) }
}

async function ensurePrices(stripe: Stripe): Promise<Record<'month' | 'year', string>> {
  const found = await stripe.prices.list({ lookup_keys: [PRICES.month.lookup_key, PRICES.year.lookup_key], active: true, limit: 10 })
  const byKey: Record<string, string> = {}
  for (const p of found.data) if (p.lookup_key) byKey[p.lookup_key] = p.id
  let productId = found.data[0] ? String(found.data[0].product) : ''
  if (!byKey[PRICES.month.lookup_key] || !byKey[PRICES.year.lookup_key]) {
    if (!productId) {
      const existing = await stripe.products.search({ query: "metadata['kh_product']:'premium'", limit: 1 }).catch(() => null)
      productId = existing?.data?.[0]?.id || ''
    }
    if (!productId) {
      const prod = await stripe.products.create({
        name: 'KoreHani Premium',
        description: 'Full Korean study program: Grammar Path, weekly writing with tutor review, reviews, live class.',
        metadata: { kh_product: 'premium' },
      })
      productId = prod.id
    }
    for (const k of ['month', 'year'] as const) {
      if (byKey[PRICES[k].lookup_key]) continue
      const price = await stripe.prices.create({
        product: productId, currency: 'usd', unit_amount: PRICES[k].unit_amount,
        recurring: { interval: PRICES[k].interval }, lookup_key: PRICES[k].lookup_key, nickname: PRICES[k].nickname,
      })
      byKey[PRICES[k].lookup_key] = price.id
    }
  }
  return { month: byKey[PRICES.month.lookup_key], year: byKey[PRICES.year.lookup_key] }
}

async function ensureLivePrice(stripe: Stripe): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [LIVE_PRICE.lookup_key], active: true, limit: 1 })
  if (found.data[0]) return found.data[0].id
  const existing = await stripe.products.search({ query: "metadata['kh_product']:'live_class'", limit: 1 }).catch(() => null)
  let productId = existing?.data?.[0]?.id || ''
  if (!productId) {
    const prod = await stripe.products.create({
      name: 'KoreHani Weekend Live Class',
      description: "One seat in this week's 60-minute live class on Zoom (this week's topic and articles).",
      metadata: { kh_product: 'live_class' },
    })
    productId = prod.id
  }
  const price = await stripe.prices.create({
    product: productId, currency: 'usd', unit_amount: LIVE_PRICE.unit_amount,
    lookup_key: LIVE_PRICE.lookup_key, nickname: LIVE_PRICE.nickname,
  })
  return price.id
}

async function getUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization') || ''
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } })
  return r.ok ? await r.json().catch(() => null) : null
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
  const sb = createClient(supabaseUrl, serviceKey)

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    const user = await getUser(req, supabaseUrl, anonKey)
    if (!user?.id) return json({ ok: false, error: 'not_signed_in' }, 401)
    const isAdmin = user.email === ADMIN_EMAIL

    const sc = await stripeClient(sb)
    if (!sc) return json({ ok: false, error: 'billing_not_configured' }, 503)
    const stripe = sc.stripe

    if (action === 'status' || action === 'setup') {
      if (!isAdmin) return json({ ok: false, error: 'forbidden' }, 403)
      const account = await stripe.accounts.retrieve().catch((e: any) => ({ error: String(e?.message || e) })) as any
      if (account?.error) return json({ ok: false, error: 'stripe_key_invalid', detail: account.error }, 400)
      const out: Record<string, any> = {
        ok: true, livemode: sc.live,
        account: account?.settings?.dashboard?.display_name || account?.id,
      }
      if (action === 'setup') {
        out.prices = await ensurePrices(stripe)
        // Customer portal (cancel / card / invoices / switch monthly<->annual)
        // needs a saved configuration. Its id is stored in app_settings
        // 'stripe_portal_config_id' and passed to every portal session.
        const priceObj = await stripe.prices.retrieve(out.prices.month)
        const productId = typeof priceObj.product === 'string' ? priceObj.product : priceObj.product?.id
        const subscriptionUpdate = {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [{ product: productId, prices: [out.prices.month, out.prices.year] }],
        }
        const { data: storedConf } = await sb.from('app_settings').select('value').eq('key', 'stripe_portal_config_id').maybeSingle()
        let confId = String(storedConf?.value || '')
        if (confId) {
          const c = await stripe.billingPortal.configurations.retrieve(confId).catch(() => null)
          if (!c || !c.active) confId = ''
        }
        if (!confId) {
          const confs = await stripe.billingPortal.configurations.list({ active: true, limit: 10 })
          const pick = confs.data.find((c: any) => c.is_default) || confs.data[0]
          confId = pick?.id || ''
        }
        if (!confId) {
          const created = await stripe.billingPortal.configurations.create({
            business_profile: { headline: 'KoreHani Premium' },
            features: {
              customer_update: { enabled: true, allowed_updates: ['email'] },
              invoice_history: { enabled: true },
              payment_method_update: { enabled: true },
              subscription_cancel: { enabled: true, mode: 'at_period_end' },
              subscription_update: subscriptionUpdate,
            },
          })
          confId = created.id
          out.portal = 'created'
        } else {
          await stripe.billingPortal.configurations.update(confId, { features: { subscription_update: subscriptionUpdate } })
          out.portal = 'updated'
        }
        await sb.from('app_settings').upsert({ key: 'stripe_portal_config_id', value: confId, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        out.portal_config_id = confId
        const url = `${supabaseUrl}/functions/v1/billing-webhook`
        const hooks = await stripe.webhookEndpoints.list({ limit: 100 })
        let hook = hooks.data.find((h: any) => h.url === url && h.status === 'enabled')
        if (!hook) {
          hook = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: 'KoreHani Premium → user_subscriptions' })
          // The signing secret is only returned at creation time.
          await sb.from('app_settings').upsert({ key: 'stripe_billing_webhook_secret', value: (hook as any).secret, updated_at: new Date().toISOString() }, { onConflict: 'key' })
          out.webhook = 'created'
        } else {
          const { data: sec } = await sb.from('app_settings').select('value').eq('key', 'stripe_billing_webhook_secret').maybeSingle()
          if (!sec?.value) {
            // Endpoint exists but we lost its secret → recreate it.
            await stripe.webhookEndpoints.del(hook.id)
            const fresh = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS, description: 'KoreHani Premium → user_subscriptions' })
            await sb.from('app_settings').upsert({ key: 'stripe_billing_webhook_secret', value: (fresh as any).secret, updated_at: new Date().toISOString() }, { onConflict: 'key' })
            out.webhook = 'recreated'
          } else {
            const missing = WEBHOOK_EVENTS.filter((e: string) => !hook!.enabled_events.includes(e) && !hook!.enabled_events.includes('*'))
            if (missing.length) await stripe.webhookEndpoints.update(hook.id, { enabled_events: WEBHOOK_EVENTS })
            out.webhook = 'ok'
          }
        }
      }
      return json(out)
    }

    // Shared: the user's subscription row (may be absent).
    const { data: sub } = await sb.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle()

    if (action === 'checkout') {
      const interval = body?.interval === 'year' ? 'year' : 'month'
      const active = sub && sub.status === 'active' && ['premium', 'standard', 'pro'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date())
      if (active && sub.payment_provider === 'stripe') return json({ ok: false, error: 'already_subscribed' }, 409)
      const prices = await ensurePrices(stripe)
      let customerId = sub?.stripe_customer_id || ''
      // Trial only on the user's first-ever subscription: our flag AND Stripe's history.
      let trialEligible = TRIAL_DAYS > 0 && !sub?.trial_used
      if (customerId) {
        // Stripe is the source of truth: block a second live subscription even if
        // our row is stale (e.g. webhook lag or an admin manual plan change).
        const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
        if (existing.data.some((s: any) => ['trialing', 'active', 'past_due'].includes(s.status))) {
          return json({ ok: false, error: 'already_subscribed' }, 409)
        }
        if (existing.data.length) trialEligible = false
      }
      if (!customerId) {
        const c = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } })
        customerId = c.id
        await sb.from('user_subscriptions').upsert({
          user_id: user.id, stripe_customer_id: customerId,
          plan: sub?.plan || 'free', status: sub?.status || 'active', updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: prices[interval], quantity: 1 }],
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { user_id: user.id },
          ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
        },
        metadata: { user_id: user.id, product: 'kh-premium' },
        success_url: `${APP_BASE_URL}/korehan-courses.html?billing=ok&trial=${trialEligible ? 1 : 0}`,
        cancel_url: `${APP_BASE_URL}/korehan-courses.html?billing=cancel`,
      })
      return json({ ok: true, url: session.url, trial: trialEligible })
    }

    if (action === 'portal') {
      if (!sub?.stripe_customer_id) return json({ ok: false, error: 'no_customer' }, 404)
      const { data: pc } = await sb.from('app_settings').select('value').eq('key', 'stripe_portal_config_id').maybeSingle()
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(pc?.value ? { configuration: String(pc.value) } : {}),
        return_url: `${APP_BASE_URL}/korehan-courses.html`,
      })
      return json({ ok: true, url: portal.url })
    }

    if (action === 'live_checkout' || action === 'live_cancel') {
      const sessionId = String(body?.session_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ ok: false, error: 'bad_session' }, 400)
      const { data: ls } = await sb.from('weekly_live_sessions')
        .select('id,title,scheduled_at,registration_deadline,max_attendees,is_cancelled').eq('id', sessionId).maybeSingle()
      if (!ls || ls.is_cancelled) return json({ ok: false, error: 'no_session' }, 404)
      const startMs = new Date(ls.scheduled_at).getTime()
      const { data: mine } = await sb.from('weekly_live_registrations')
        .select('id,status,hold_until,stripe_session_id,stripe_payment_intent')
        .eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()

      if (action === 'live_cancel') {
        if (!mine || mine.status !== 'paid' || !mine.stripe_payment_intent) return json({ ok: false, error: 'no_paid_seat' }, 404)
        if (startMs - Date.now() < LIVE_REFUND_MS) return json({ ok: false, error: 'too_late' }, 409)
        await stripe.refunds.create({ payment_intent: mine.stripe_payment_intent, metadata: { user_id: user.id, live_session_id: sessionId } })
        await sb.from('weekly_live_registrations')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', mine.id)
        return json({ ok: true, refunded: true })
      }

      // live_checkout — Premium members only.
      const { data: premium } = await sb.rpc('kh_is_premium', { p_user: user.id })
      if (!premium && !isAdmin) return json({ ok: false, error: 'premium_only' }, 403)
      const closeMs = Math.min(ls.registration_deadline ? new Date(ls.registration_deadline).getTime() : startMs, startMs)
      if (Date.now() >= closeMs) return json({ ok: false, error: 'closed' }, 409)
      if (mine && ['paid', 'comp'].includes(mine.status)) return json({ ok: false, error: 'already_booked' }, 409)
      const now = Date.now()
      if (mine && mine.status === 'pending' && mine.hold_until && new Date(mine.hold_until).getTime() > now + 60_000 && mine.stripe_session_id) {
        // Checkout already open for this seat — send them back to it.
        const open = await stripe.checkout.sessions.retrieve(mine.stripe_session_id).catch(() => null) as any
        if (open && open.status === 'open' && open.url) return json({ ok: true, url: open.url })
      }
      const holdUntil = new Date(now + LIVE_HOLD_MS).toISOString()
      const { data: held, error: holdErr } = await sb.rpc('kh_live_hold_seat', { p_session: sessionId, p_user: user.id, p_email: user.email || null, p_hold_until: holdUntil })
      if (holdErr) throw new Error('hold: ' + holdErr.message)
      if (held === 'full') return json({ ok: false, error: 'full' }, 409)
      if (held === 'booked') return json({ ok: false, error: 'already_booked' }, 409)
      if (held !== 'ok') return json({ ok: false, error: String(held || 'hold_failed') }, 409)
      const release = () => sb.from('weekly_live_registrations').delete()
        .eq('session_id', sessionId).eq('user_id', user.id).eq('status', 'pending')

      let session: Stripe.Checkout.Session
      try {
      const priceId = await ensureLivePrice(stripe)
      let customerId = sub?.stripe_customer_id || ''
      if (!customerId) {
        const c = await stripe.customers.create({ email: user.email || undefined, metadata: { user_id: user.id } })
        customerId = c.id
        await sb.from('user_subscriptions').upsert({
          user_id: user.id, stripe_customer_id: customerId,
          plan: sub?.plan || 'free', status: sub?.status || 'active', updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
      const meta = { user_id: user.id, product: 'kh-live-class', live_session_id: sessionId }
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: meta,
        payment_intent_data: { metadata: meta, description: 'Live class seat — ' + new Date(ls.scheduled_at).toISOString().slice(0, 10) },
        expires_at: Math.floor((now + LIVE_HOLD_MS) / 1000),
        success_url: `${APP_BASE_URL}/korehan-courses.html?live=ok#live`,
        cancel_url: `${APP_BASE_URL}/korehan-courses.html?live=cancel#live`,
      })
      } catch (e) { await release(); throw e }
      await sb.from('weekly_live_registrations').update({ stripe_session_id: session.id })
        .eq('session_id', sessionId).eq('user_id', user.id)
      return json({ ok: true, url: session.url })
    }

    return json({ ok: false, error: 'unknown_action' }, 400)
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300)
    console.error('[billing]', msg)
    await sb.from('client_errors').insert({
      message: 'billing: ' + msg, severity: 'error', context: { source: 'billing' }, user_agent: 'edge-function',
    }).then(() => {}, () => {})
    return json({ ok: false, error: 'billing_error', detail: msg }, 500)
  }
})
