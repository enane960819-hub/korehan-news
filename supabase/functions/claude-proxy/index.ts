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
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
  // Returning an ACAO header for unlisted origins makes CDN-cached
  // responses leak across origins (the cache keys by Vary:Origin but
  // we'd still echo back the wrong allowlisted origin). Omit ACAO
  // entirely for unknown origins so the browser blocks the response
  // and the CDN stores nothing reusable cross-origin.
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

// Admins bypass all quotas + email verification.
const ADMIN_EMAILS = ['enane960819@gmail.com']

// Tutors are admin-adjacent users with elevated payload limits for
// legitimate tutor-only flows (e.g. Preply screenshot OCR, which
// sends 1–5 base64 images per request → ~5 MB total). Keep in sync
// with `korehan-shared.js#KH_TUTOR_EMAILS` and
// `supabase/migrations/20260428_tutor_dashboard.sql#is_tutor_user`.
const TUTOR_EMAILS = ['enane960819@gmail.com', 'aliciarburgess@gmail.com']

// Tutor-only feature prefix that's allowed to bypass MAX_INPUT_BYTES.
// Image-OCR features legitimately need multi-MB payloads. Any feature
// not on this prefix list (even from a tutor) still hits the 80 KB
// cost-protection cap.
const TUTOR_LARGE_PAYLOAD_PREFIXES = ['tutor-import-']
// 15 MB: 5 screenshots × ~2.5 MB resized PNG × 1.33 base64 overhead ≈ 13 MB worst-case.
const TUTOR_MAX_INPUT_BYTES = 15 * 1024 * 1024

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

// Per-call max INPUT bytes (UTF-8). Anthropic input is the dominant
// cost driver in this codebase — a single 200K-token Sonnet input
// burns ~$0.60, which is 6% of the free monthly cap. The biggest
// legitimate prompt we send is the article-body gen (~12K tokens =
// ~50KB JSON). 80KB leaves comfortable headroom while killing the
// "stuff entire HTML pages into messages" attack class.
const MAX_INPUT_BYTES = 80_000

// Anthropic call timeout. Above this we abort the connection so the
// client doesn't hang on a stalled upstream and we don't keep the
// function billed alive. Bumped to 90s — the combined Sonnet article-
// generation call (verbose Beginner-level analysis with conjugation
// chains) routinely runs 40-60s, leaving little headroom at the
// previous 45s cap.
const ANTHROPIC_TIMEOUT_MS = 90_000

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

    // Tutor large-payload carve-out. The Preply screenshot importer sends
    // 1–5 base64 images per request; even one resized 1600px PNG is well
    // past the 80 KB default cap. Tutors are identified by hardcoded
    // email allowlist (mirrors is_tutor_user RPC + KH_TUTOR_EMAILS).
    // The carve-out ONLY applies to features that prefix-match
    // TUTOR_LARGE_PAYLOAD_PREFIXES, so a tutor's regular learning-flow
    // calls still hit the standard cap.
    const isTutor = !isAdmin
      && !!userData.email
      && TUTOR_EMAILS.includes(userData.email.toLowerCase())
    const featureIsTutorLarge = typeof feature === 'string'
      && TUTOR_LARGE_PAYLOAD_PREFIXES.some((p) => feature.startsWith(p))

    // Input size cap — protects the monthly cost budget from a single
    // request stuffing 200K tokens into messages. Admins bypass since
    // article-cache regeneration legitimately approaches this ceiling.
    // Verified tutors on tutor-only features get a higher cap for the
    // image-OCR flows (TUTOR_MAX_INPUT_BYTES).
    if (!isAdmin) {
      const msgBytes = new TextEncoder().encode(JSON.stringify(claudeBody.messages || [])).length
      const cap = (isTutor && featureIsTutorLarge) ? TUTOR_MAX_INPUT_BYTES : MAX_INPUT_BYTES
      if (msgBytes > cap) {
        return jsonResponse({
          error: 'Input too large',
          detail: `Request is ${Math.round(msgBytes / 1024)}KB; per-call limit is ${Math.round(cap / 1024)}KB.`,
          code: 'input_too_large',
        }, 413, cors)
      }
    }

    // Cap feature string length — it's user-supplied and lands
    // verbatim in claude_api_usage. Without a cap, a hostile client
    // can balloon the log table with multi-KB feature names.
    const featureStr = (typeof feature === 'string' && feature.length)
      ? feature.slice(0, 64)
      : null

    // ── 6. Anthropic call with timeout ───────────────────────────
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), ANTHROPIC_TIMEOUT_MS)
    let response: Response
    try {
      // Detect whether the client wants prompt caching — any content
      // block on any message that carries a cache_control field signals
      // intent. Caching is GA on Claude 4.x but sending the explicit
      // beta header is a no-op when not needed and lights the feature
      // up on older API surfaces, so we send it whenever requested.
      let wantsPromptCaching = false
      const msgs = (claudeBody as { messages?: unknown }).messages
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          const content = (m as { content?: unknown })?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block && typeof block === 'object' && 'cache_control' in block) {
                wantsPromptCaching = true
                break
              }
            }
          }
          if (wantsPromptCaching) break
        }
      }

      const anthropicHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      if (wantsPromptCaching) {
        anthropicHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31'
      }
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
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
    // We log EVERY call — including failures — so the daily counter
    // can't be gamed by deliberately producing 4xx/5xx responses to
    // avoid quota deduction. Token counts are 0 for non-200 paths
    // since Anthropic didn't bill us, but the row still counts toward
    // the daily call limit on the next request.
    //
    // Prompt caching: Anthropic returns three input figures when the
    // request uses cache_control — input_tokens (non-cached portion),
    // cache_creation_input_tokens (1.25x cost), cache_read_input_tokens
    // (0.1x cost). The monthly-cost computation in this proxy only
    // reads `input_tokens`, so we fold the cache portions into it
    // using their pricing weights so priceUsd() returns the actual
    // dollars spent. (Schema-friendly: no new columns needed.)
    const usage = data?.usage as {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    } | undefined
    const baseInput   = usage?.input_tokens ?? 0
    const cacheCreate = usage?.cache_creation_input_tokens ?? 0
    const cacheRead   = usage?.cache_read_input_tokens ?? 0
    const effectiveInput = baseInput + Math.round(cacheCreate * 1.25) + Math.round(cacheRead * 0.1)
    sb.from('claude_api_usage').insert({
      user_id: userId,
      feature: featureStr,
      model: typeof claudeBody.model === 'string' ? claudeBody.model : null,
      input_tokens:  response.ok ? effectiveInput : 0,
      output_tokens: response.ok ? (usage?.output_tokens ?? 0) : 0,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[claude-proxy] usage insert failed:', error.message)
    })

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
