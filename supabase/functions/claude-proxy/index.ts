import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
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

// Admins bypass all quotas + rate limits.
const ADMIN_EMAILS = ['enane960819@gmail.com']

// Default free-tier daily limits. user_quota_overrides can raise these
// for paid users / specific accounts.
const FREE_DAILY_CALLS = 50
const FREE_DAILY_TOKENS = 200_000

// Hard upper bound on a single Claude call. Stops a single request from
// blowing the budget (default Claude max_tokens for haiku/sonnet is 4k,
// for opus 8k). Anything higher than this gets clamped.
const MAX_TOKENS_PER_CALL = 4096

// Anthropic call timeout. Beyond this the connection is aborted so the
// caller doesn't hang forever and we don't keep paying for a request
// the user gave up on. Long enough for the slowest legitimate Claude
// generation, short enough to surface real outages.
const ANTHROPIC_TIMEOUT_MS = 45_000

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
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

    // ── 2. API key (with error check) ───────────────────────────
    // Previously the destructured error was discarded, so a missing
    // app_settings row or an RLS denial returned `setting === null`
    // and the proxy tripped on `setting?.value` with a misleading "No
    // API key configured" — same surface for "DB unreachable" and
    // "key genuinely not set". We now distinguish them.
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

    // ── 3. Per-user daily quota ─────────────────────────────────
    // Skip for admins. For everyone else, count today's rows in
    // claude_api_usage and reject if over the daily call limit.
    // user_quota_overrides can raise the cap for paid plans.
    if (!isAdmin) {
      const dayStart = new Date()
      dayStart.setUTCHours(0, 0, 0, 0)

      // Pull the user's override (if any). Free users have no row.
      const { data: override } = await sb
        .from('user_quota_overrides')
        .select('daily_call_limit, daily_token_limit')
        .eq('user_id', userId)
        .maybeSingle()

      const callLimit  = override?.daily_call_limit  ?? FREE_DAILY_CALLS
      const tokenLimit = override?.daily_token_limit ?? FREE_DAILY_TOKENS

      const { data: usage, error: usageErr } = await sb
        .from('claude_api_usage')
        .select('input_tokens, output_tokens')
        .eq('user_id', userId)
        .gte('created_at', dayStart.toISOString())

      if (usageErr) {
        // Don't fail-open here — if we can't read usage we can't
        // protect the budget. Better to surface a transient error than
        // bypass the quota silently.
        console.error('[claude-proxy] usage query failed:', usageErr.message)
        return jsonResponse({ error: 'Quota check failed, please retry' }, 503, cors)
      }

      const callsToday = usage?.length ?? 0
      const tokensToday = (usage ?? []).reduce(
        (acc: number, row: { input_tokens?: number; output_tokens?: number }) =>
          acc + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
        0,
      )

      if (callsToday >= callLimit) {
        return jsonResponse(
          {
            error: 'Daily AI usage limit reached',
            detail: `Limit: ${callLimit} calls per day. Try again tomorrow or upgrade for higher limits.`,
            quota: { callsToday, callLimit, tokensToday, tokenLimit },
          },
          429,
          cors,
        )
      }
      if (tokensToday >= tokenLimit) {
        return jsonResponse(
          {
            error: 'Daily AI token limit reached',
            detail: `Limit: ${tokenLimit} tokens per day. Try again tomorrow or upgrade.`,
            quota: { callsToday, callLimit, tokensToday, tokenLimit },
          },
          429,
          cors,
        )
      }
    }

    // ── 4. Body + parameter sanitization ─────────────────────────
    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    const { feature, ...claudeBody } = body
    // Clamp max_tokens — without this, a buggy or hostile client
    // could request a 200k-token completion and burn the budget on
    // a single call.
    if (typeof claudeBody.max_tokens === 'number' && claudeBody.max_tokens > MAX_TOKENS_PER_CALL) {
      claudeBody.max_tokens = MAX_TOKENS_PER_CALL
    }

    // ── 5. Anthropic call with timeout ───────────────────────────
    // The previous proxy awaited fetch() with no AbortController, so a
    // stalled Anthropic CDN connection would hang the function until
    // the platform-level kill timeout (~150s). We bound it explicitly.
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

    let data: any
    try {
      data = await response.json()
    } catch {
      return jsonResponse({ error: 'Bad response from AI service' }, 502, cors)
    }

    // ── 6. Log usage (fire-and-forget; don't block the response) ─
    // Token counts come straight from Anthropic's usage object so we
    // bill exactly what was consumed, not what we estimated.
    if (response.ok && data?.usage) {
      sb.from('claude_api_usage').insert({
        user_id: userId,
        feature: feature || null,
        input_tokens: data.usage.input_tokens ?? 0,
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
