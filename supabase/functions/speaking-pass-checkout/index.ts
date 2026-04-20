// ══════════════════════════════════════════════════════════════════════
// speaking-pass-checkout — create a Stripe Checkout session for a
// single-day Speaking Coach pass ($1 for Seed/Sprout, $3 for Tree).
//
// Auth:   Bearer <user JWT>  (enforced via Supabase `verify_jwt=true`)
// Body:   { level: 'Starter' | 'Beginner' | 'Intermediate' }
// Reply:  { url: "https://checkout.stripe.com/..." }  — FE redirects.
//
// The checkout session carries:
//   - metadata.user_id            → target user (looked up server-side)
//   - metadata.level              → which pass
//   - metadata.valid_date         → KST date the pass is good for
//   - client_reference_id         → same user_id (redundant for logs)
//
// The webhook (speaking-pass-webhook) reads that metadata and calls
// create_speaking_pass() to provision coins once payment succeeds.
//
// ── Secrets (Supabase → Project → Edge Functions → Secrets) ─────────
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_PRICE_SEED_SPROUT price_...    ($1 one-time)
//   STRIPE_PRICE_TREE        price_...    ($3 one-time)
//   APP_BASE_URL             https://korehannews.com
// ══════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Resolve the user from the JWT (Supabase auth-helper).
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401);
    const user = userData.user;

    // Plan check: Pro-tier only.
    const { data: sub } = await sb.from('user_subscriptions')
      .select('plan, status, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPro = sub && sub.status === 'active' && sub.plan === 'pro'
      && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    if (!isPro) return json({ error: 'pro_plan_required' }, 403);

    const body = await req.json().catch(() => ({} as any));
    const level = String(body.level || '');
    const PRICE_MAP: Record<string, string | undefined> = {
      Starter:      Deno.env.get('STRIPE_PRICE_SEED_SPROUT'),
      Beginner:     Deno.env.get('STRIPE_PRICE_SEED_SPROUT'),
      Intermediate: Deno.env.get('STRIPE_PRICE_TREE'),
    };
    const priceId = PRICE_MAP[level];
    if (!priceId) return json({ error: 'bad_level_or_no_price_configured' }, 400);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // KST "today" — pass is scoped to the KST day.
    const validDate = new Date(Date.now() + (9 * 60 * 60 * 1000))
      .toISOString()
      .slice(0, 10);

    const appBase = Deno.env.get('APP_BASE_URL') || 'https://korehannews.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id:    user.id,
        level,
        valid_date: validDate,
        product:    'speaking-coach-pass',
      },
      success_url: `${appBase}/korehan-study-room.html?coach_pass=ok`,
      cancel_url:  `${appBase}/korehan-study-room.html?coach_pass=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('[speaking-pass-checkout]', e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
