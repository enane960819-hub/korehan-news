import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://korehani.com',
  'https://www.korehani.com',
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}

// Admins bypass all quotas + email verification.
const ADMIN_EMAILS = ['enane960819@gmail.com']

// ── Tier defaults ───────────────────────────────────────────────
// Both checks must pass — daily count protects against burst /
// dictionary-attack patterns, monthly USD protects against the
// long-tail "drip" attack where a bot stays just under the daily
// cap for weeks. A normal power user (every feature daily, every
// day) burns ~$5/month, so the $10 free cap leaves 2x headroom.
const FREE_DAILY_CALLS    = 50
const FREE_MONTHLY_USD    = 10
const STANDARD_DAILY_CALLS  = 200
const STANDARD_MONTHLY_USD  = 30
// Pro: bypass cost ceiling, keep a generous burst limit so a single
// runaway script can't drain the account.
const PRO_DAILY_CALLS     = 1000
const PRO_MONTHLY_USD     = 500

// Anthropic published prices in USD per 1M tokens.
// Unknown models default to Sonnet pricing — conservative over-count
// is preferred over an under-charge that hides budget burn.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':                 { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514':        { input:  3.00, output: 15.00 },
  'claude-sonnet-4-6':               { input:  3.00, output: 15.00 },
  'claude-3-sonnet-20240229':        { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':       { input:  0.80, output:  4.00 },
  'claude-haiku-4-5':                { input:  0.80, output:  4.00 },
}
const DEFAULT_PRICING = { input: 3.00, output: 15.00 }

// Per-call max output. A buggy/hostile client can't request a 200K
// completion in one shot — saves more than the per-month cap by
// itself in the worst case. Fast Track scenario generation needs
// ~10-12K tokens for 25-node JSON, so the cap sits at 16K.
const MAX_TOKENS_PER_CALL = 16384

// Anthropic call timeout. Above this we abort the connection so the
// client doesn't hang on a stalled upstream and we don't keep the
// function billed alive.
const ANTHROPIC_TIMEOUT_MS = 45_000

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function priceUsd(model: string | null | undefined, inputTokens: number, outputTokens: number) {
  const p = (model && MODEL_PRICING[model]) || DEFAULT_PRICING
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey

    // ── 1. Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401, cors)

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!authCheck.ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors)

    const userData = await authCheck.json()
    if (!userData?.id) return jsonResponse({ error: 'Unauthorized' }, 401, cors)

    const userId: string = userData.id
    const isAdmin = !!(userData.email && ADMIN_EMAILS.includes(userData.email))

    // ── 2. Email verification gate ───────────────────────────────
    // A bot that gets past Turnstile + disposable-email-block can
    // still create an account, but it can't AI-spend until it
    // actually owns the inbox. This single check kills almost every
    // automated-signup abuse pattern at the source — the cost cap
    // below is just defense-in-depth for whatever sneaks past.
    if (!isAdmin && !userData.email_confirmed_at) {
      return jsonResponse({
        error: 'Please verify your email before using AI features.',
        code: 'email_unverified',
      }, 403, cors)
    }

    // ── 3. Anthropic API key ─────────────────────────────────────
    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const { data: setting, error: settingErr } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'anthropic_key')
      .maybeSingle()
    if (settingErr) {
      console.error('[claude-proxy] app_settings query failed:', settingErr.message)
      return jsonResponse({ error: 'Configuration unavailable' }, 503, cors)
    }
    const apiKey = setting?.value
    if (!apiKey) return jsonResponse({ error: 'No API key configured' }, 500, cors)

    // ── 4. Quota: daily call count + monthly USD spend ───────────
    if (!isAdmin) {
      // Plan resolution. The user's plan is stored in profiles.plan
      // (free / standard / pro). Override row in user_quota_overrides
      // wins over plan defaults if set.
      let dailyCallLimit  = FREE_DAILY_CALLS
      let monthlyUsdLimit = FREE_MONTHLY_USD
      try {
        const { data: profile } = await sb
          .from('profiles')
          .select('plan')
          .eq('id', userId)
          .maybeSingle()
        const plan = profile?.plan || 'free'
        if (plan === 'standard') {
          dailyCallLimit  = STANDARD_DAILY_CALLS
          monthlyUsdLimit = STANDARD_MONTHLY_USD
        } else if (plan === 'pro') {
          dailyCallLimit  = PRO_DAILY_CALLS
          monthlyUsdLimit = PRO_MONTHLY_USD
        }
      } catch (_) { /* profile table may not exist yet — keep free defaults */ }

      const { data: override } = await sb
        .from('user_quota_overrides')
        .select('daily_call_limit, monthly_cost_limit_usd')
        .eq('user_id', userId)
        .maybeSingle()
      if (override?.daily_call_limit) dailyCallLimit = override.daily_call_limit
      if (override?.monthly_cost_limit_usd != null) monthlyUsdLimit = Number(override.monthly_cost_limit_usd)

      // Day window (KST). Most users live in Korea — using UTC means
      // the daily counter resets at 9am KST, halfway through the
      // study day. Compute KST midnight by offsetting +9h, snapping
      // to UTC date floor, then subtracting 9h back so the resulting
      // ISO timestamp is the UTC instant equivalent to KST 00:00.
      const KST_OFFSET_MS = 9 * 60 * 60 * 1000
      const nowKstMs = Date.now() + KST_OFFSET_MS
      const kstMidnightAsUtcMs = Math.floor(nowKstMs / 86_400_000) * 86_400_000 - KST_OFFSET_MS
      const dayStart = new Date(kstMidnightAsUtcMs)

      // Month window (KST). Same idea — reset on the 1st at KST 00:00.
      const kstNow = new Date(Date.now() + KST_OFFSET_MS)
      const monthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1) - KST_OFFSET_MS)

      // One round-trip pulls both windows. We fetch tokens + model so
      // we can compute exact cost rather than estimate.
      const { data: usage, error: usageErr } = await sb
        .from('claude_api_usage')
        .select('input_tokens, output_tokens, model, created_at')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())

      if (usageErr) {
        console.error('[claude-proxy] usage query failed:', usageErr.message)
        return jsonResponse({ error: 'Quota check failed, please retry' }, 503, cors)
      }

      let callsToday = 0
      let monthlyUsd = 0
      const dayStartIso = dayStart.toISOString()
      for (const row of (usage || [])) {
        if (row.created_at >= dayStartIso) callsToday += 1
        monthlyUsd += priceUsd(row.model, row.input_tokens || 0, row.output_tokens || 0)
      }

      if (callsToday >= dailyCallLimit) {
        return jsonResponse({
          error: 'Daily AI limit reached',
          detail: `Daily limit ${dailyCallLimit} calls. Resets at KST midnight.`,
          quota: { callsToday, dailyCallLimit, monthlyUsd: Math.round(monthlyUsd * 100) / 100, monthlyUsdLimit },
          code: 'daily_call_limit',
        }, 429, cors)
      }
      if (monthlyUsd >= monthlyUsdLimit) {
        return jsonResponse({
          error: 'Monthly AI usage limit reached',
          detail: `You've used $${monthlyUsd.toFixed(2)} of your $${monthlyUsdLimit} monthly AI budget. Upgrade for higher limits.`,
          quota: { callsToday, dailyCallLimit, monthlyUsd: Math.round(monthlyUsd * 100) / 100, monthlyUsdLimit },
          code: 'monthly_cost_limit',
        }, 429, cors)
      }
    }

    // ── 5. Body + parameter sanitization ─────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    const { feature, ...claudeBody } = body
    if (typeof claudeBody.max_tokens === 'number' && claudeBody.max_tokens > MAX_TOKENS_PER_CALL) {
      claudeBody.max_tokens = MAX_TOKENS_PER_CALL
    }

    // ── 6. Anthropic call with timeout ───────────────────────────
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), ANTHROPIC_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(claudeBody),
        signal: ctrl.signal,
      })
    } catch (e) {
      clearTimeout(timeoutId)
      const aborted = (e as { name?: string })?.name === 'AbortError'
      console.error('[claude-proxy] anthropic fetch failed:', aborted ? 'timeout' : (e as Error).message)
      return jsonResponse(
        { error: aborted ? 'AI service timed out, please retry' : 'AI service unavailable' },
        aborted ? 504 : 502,
        cors,
      )
    }
    clearTimeout(timeoutId)

    let data: { usage?: { input_tokens?: number; output_tokens?: number } } & Record<string, unknown>
    try {
      data = await response.json()
    } catch {
      return jsonResponse({ error: 'Bad response from AI service' }, 502, cors)
    }

    // ── 7. Log usage (fire-and-forget) ───────────────────────────
    if (response.ok && data?.usage) {
      sb.from('claude_api_usage').insert({
        user_id: userId,
        feature: feature || null,
        model: typeof claudeBody.model === 'string' ? claudeBody.model : null,
        input_tokens:  data.usage.input_tokens ?? 0,
        output_tokens: data.usage.output_tokens ?? 0,
      }).then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('[claude-proxy] usage insert failed:', error.message)
      })
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[claude-proxy] uncaught:', (e as Error).message)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
