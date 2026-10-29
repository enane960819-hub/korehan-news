// billing — KoreHani Premium / Premium Live subscriptions (Stripe).
//
// Plans (owner decision, 2026-10-29):
//   Premium       $8.99/month or $69/year — every self-study feature, no live class.
//   Premium Live  $27.99/month (monthly only) — everything in Premium + one live
//                 class every week with a seat included (Sunday 21:00 KST on Zoom,
//                 60 min, 8 seats). Book / cancel until booking closes (1 h before);
//                 missed classes don't roll over. The $5 single-seat purchase is gone.
//
// Actions (POST JSON { action, ... }):
//   checkout { plan: 'premium'|'live', interval: 'month'|'year' }
//                                          signed-in user → Stripe Checkout URL
//                                          ('live' is always monthly; no free trial —
//                                          owner, 2026-10-28). A Premium subscriber
//                                          asking for 'live' is switched in place
//                                          (prorated) → { ok, upgraded: true }
//   portal                                 signed-in user → Stripe Billing Portal URL
//                                          (cancel, change card, invoices, switch plan)
//   setup                                  admin only → ensures both products, all
//                                          prices, the portal config and the webhook
//                                          endpoint exist; stores the webhook secret
//   status                                 admin only → what is configured
//   live_reserve { session_id }            Premium Live member → books the included
//                                          seat (status 'comp') while booking is open
//   live_cancel { session_id }             included seat → freed while booking is open;
//                                          legacy $5 paid seat, 24 h+ before → refund
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
// Premium Live — monthly only, on its own product (owner, 2026-10-29).
// billing-webhook maps this lookup_key to plan 'premium_live'.
export const LIVE_PLAN_PRICE = { lookup_key: 'kh_premium_live_month', unit_amount: 2799, interval: 'month' as const, nickname: 'Premium Live monthly' }
// Legacy $5 seats (sold until 2026-10-29): cancel up to 24 h before = full refund.
const LIVE_REFUND_MS = 24 * 3600 * 1000
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
        description: 'Full Korean self-study program: Grammar Path, weekly writing with tutor review, reviews.',
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

async function ensureLivePlanPrice(stripe: Stripe): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [LIVE_PLAN_PRICE.lookup_key], active: true, limit: 1 })
  if (found.data[0]) return found.data[0].id
  const existing = await stripe.products.search({ query: "metadata['kh_product']:'premium_live'", limit: 1 }).catch(() => null)
  let productId = existing?.data?.[0]?.id || ''
  if (!productId) {
    const prod = await stripe.products.create({
      name: 'KoreHani Premium Live',
      description: 'Everything in Premium, plus one live class every week with a seat included (Sunday 21:00 KST on Zoom, 60 min, 8 seats).',
      metadata: { kh_product: 'premium_live' },
    })
    productId = prod.id
  }
  const price = await stripe.prices.create({
    product: productId, currency: 'usd', unit_amount: LIVE_PLAN_PRICE.unit_amount,
    recurring: { interval: LIVE_PLAN_PRICE.interval }, lookup_key: LIVE_PLAN_PRICE.lookup_key, nickname: LIVE_PLAN_PRICE.nickname,
  })
  return price.id
}

function productOf(price: Stripe.Price): string {
  return typeof price.product === 'string' ? price.product : price.product?.id
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

    // Weekend Live Class seats. Included seats need no Stripe call, so this
    // runs before the Stripe client is required.
    if (action === 'live_reserve' || action === 'live_cancel') {
      const sessionId = String(body?.session_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ ok: false, error: 'bad_session' }, 400)
      const { data: ls } = await sb.from('weekly_live_sessions')
        .select('id,title,scheduled_at,registration_deadline,max_attendees,is_cancelled').eq('id', sessionId).maybeSingle()
      if (!ls || ls.is_cancelled) return json({ ok: false, error: 'no_session' }, 404)
      const startMs = new Date(ls.scheduled_at).getTime()
      const closeMs = Math.min(ls.registration_deadline ? new Date(ls.registration_deadline).getTime() : startMs, startMs)
      const { data: mine } = await sb.from('weekly_live_registrations')
        .select('id,status,stripe_payment_intent')
        .eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()

      if (action === 'live_cancel') {
        // Included (Premium Live) seat: free it while booking is still open.
        if (mine && mine.status === 'comp') {
          if (Date.now() >= closeMs) return json({ ok: false, error: 'too_late' }, 409)
          const { error: delErr } = await sb.from('weekly_live_registrations').delete().eq('id', mine.id).eq('status', 'comp')
          if (delErr) throw new Error('cancel: ' + delErr.message)
          return json({ ok: true, cancelled: true })
        }
        // Legacy $5 seat: full refund up to 24 h before class.
        if (!mine || mine.status !== 'paid' || !mine.stripe_payment_intent) return json({ ok: false, error: 'no_seat' }, 404)
        if (startMs - Date.now() < LIVE_REFUND_MS) return json({ ok: false, error: 'too_late' }, 409)
        const scRefund = await stripeClient(sb)
        if (!scRefund) return json({ ok: false, error: 'billing_not_configured' }, 503)
        await scRefund.stripe.refunds.create({ payment_intent: mine.stripe_payment_intent, metadata: { user_id: user.id, live_session_id: sessionId } })
        await sb.from('weekly_live_registrations')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', mine.id)
        return json({ ok: true, refunded: true })
      }

      // live_reserve — Premium Live members only (seat included in the plan).
      const { data: hasLive } = await sb.rpc('kh_has_live', { p_user: user.id })
      if (!hasLive && !isAdmin) return json({ ok: false, error: 'live_only' }, 403)
      if (Date.now() >= closeMs) return json({ ok: false, error: 'closed' }, 409)
      if (mine && ['paid', 'comp'].includes(mine.status)) return json({ ok: false, error: 'already_booked' }, 409)
      const { data: booked, error: bookErr } = await sb.rpc('kh_live_reserve_seat', { p_session: sessionId, p_user: user.id, p_email: user.email || null })
      if (bookErr) throw new Error('reserve: ' + bookErr.message)
      if (booked === 'full') return json({ ok: false, error: 'full' }, 409)
      if (booked === 'booked') return json({ ok: false, error: 'already_booked' }, 409)
      if (booked === 'no_session') return json({ ok: false, error: 'no_session' }, 404)
      if (booked !== 'ok') return json({ ok: false, error: String(booked || 'reserve_failed') }, 409)
      return json({ ok: true, booked: true })
    }

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
        out.live_price = await ensureLivePlanPrice(stripe)
        // Customer portal (cancel / card / invoices / switch monthly<->annual
        // and Premium<->Premium Live) needs a saved configuration. Its id is
        // stored in app_settings 'stripe_portal_config_id' and passed to every
        // portal session.
        const premiumProduct = productOf(await stripe.prices.retrieve(out.prices.month))
        const liveProduct = productOf(await stripe.prices.retrieve(out.live_price))
        const subscriptionUpdate = {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [
            { product: premiumProduct, prices: [out.prices.month, out.prices.year] },
            { product: liveProduct, prices: [out.live_price] },
          ],
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
      // 'live' = Premium Live, monthly only (owner, 2026-10-29).
      const wantLive = body?.plan === 'live'
      const interval = wantLive ? 'month' : (body?.interval === 'year' ? 'year' : 'month')
      const active = sub && sub.status === 'active' && ['premium', 'premium_live', 'standard', 'pro'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date())
      // A Stripe Premium member asking for Live is upgraded in place below;
      // anything else on an active Stripe row is already subscribed.
      if (active && sub.payment_provider === 'stripe' && !(wantLive && sub.plan !== 'premium_live')) {
        return json({ ok: false, error: 'already_subscribed' }, 409)
      }
      let customerId = sub?.stripe_customer_id || ''
      // Trial only on the user's first-ever subscription: our flag AND Stripe's history.
      let trialEligible = TRIAL_DAYS > 0 && !sub?.trial_used
      if (customerId) {
        // Stripe is the source of truth: block a second live subscription even if
        // our row is stale (e.g. webhook lag or an admin manual plan change).
        const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
        const current = existing.data.find((s: Stripe.Subscription) => ['trialing', 'active', 'past_due'].includes(s.status))
        if (current) {
          // Subscription items carry the full Price object, so lookup_key is here.
          const onLive = current.items.data.some((it: Stripe.SubscriptionItem) => it.price?.lookup_key === LIVE_PLAN_PRICE.lookup_key)
          if (wantLive && !onLive && current.items.data[0]) {
            // Premium → Premium Live: switch the existing subscription's price
            // (prorated) instead of opening a second checkout. billing-webhook
            // picks up customer.subscription.updated and sets plan 'premium_live'.
            const livePriceId = await ensureLivePlanPrice(stripe)
            await stripe.subscriptions.update(current.id, {
              items: [{ id: current.items.data[0].id, price: livePriceId }],
              proration_behavior: 'create_prorations',
              cancel_at_period_end: false,
              metadata: { ...current.metadata, user_id: current.metadata?.user_id || user.id },
            })
            return json({ ok: true, upgraded: true })
          }
          return json({ ok: false, error: 'already_subscribed' }, 409)
        }
        if (existing.data.length) trialEligible = false
      }
      const priceId = wantLive ? await ensureLivePlanPrice(stripe) : (await ensurePrices(stripe))[interval]
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
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { user_id: user.id },
          ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
        },
        metadata: { user_id: user.id, product: wantLive ? 'kh-premium-live' : 'kh-premium' },
        success_url: `${APP_BASE_URL}/korehan-courses.html?billing=ok&plan=${wantLive ? 'live' : 'premium'}&trial=${trialEligible ? 1 : 0}`,
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
