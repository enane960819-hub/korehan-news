// ══════════════════════════════════════════════════════════════════════
// speaking-pass-checkout — create a Stripe Checkout session for a
// Speaking Coach coin top-up. Flat $1 per coin, minimum 5 coins.
//
// Auth:   Bearer <user JWT>  (user must be on Pro plan)
// Body:   { coins: integer }    // minimum 5
// Reply:  { url: "https://checkout.stripe.com/..." }  — FE redirects.
//
// Stripe setup uses a SINGLE $1 one-time price; the quantity on the
// line item does the scaling. That keeps Stripe config dead simple
// and lets us offer any pack size (5, 10, 20, 50 …) with one price.
//
// ── Secrets (Supabase → Project → Edge Functions → Secrets) ─────────
//   STRIPE_SECRET_KEY          sk_live_... or sk_test_...
//   STRIPE_PRICE_COACH_COIN    price_...    ($1 one-time)
//   APP_BASE_URL               https://korehani.com
// ══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MIN_COINS = 5;
const MAX_COINS = 200;   // sanity cap — Stripe quantity is bounded anyway

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405);

  try {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'auth required' }, 401);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401);
    const user = userData.user;

    // Pro-tier gate
    const { data: sub } = await sb.from('user_subscriptions')
      .select('plan, status, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPro = sub && sub.status === 'active' && sub.plan === 'pro'
      && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    if (!isPro) return json({ error: 'pro_plan_required' }, 403);

    const body = await req.json().catch(() => ({} as any));
    const coins = Math.floor(Number(body.coins));
    if (!Number.isFinite(coins)) return json({ error: 'coins_required' }, 400);
    if (coins < MIN_COINS)       return json({ error: 'min_coins_5' }, 400);
    if (coins > MAX_COINS)       return json({ error: 'max_coins_' + MAX_COINS }, 400);

    const priceId = Deno.env.get('STRIPE_PRICE_COACH_COIN');
    if (!priceId) return json({ error: 'stripe_price_not_configured' }, 500);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const appBase = Deno.env.get('APP_BASE_URL') || 'https://korehani.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: coins, adjustable_quantity: { enabled: false } }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        coins:   String(coins),
        product: 'speaking-coach-coins',
      },
      success_url: `${appBase}/korehan-study-room.html?coach_coins=ok`,
      cancel_url:  `${appBase}/korehan-study-room.html?coach_coins=cancel`,
    });

    return json({ url: session.url, coins });
  } catch (e) {
    console.error('[speaking-pass-checkout]', e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
