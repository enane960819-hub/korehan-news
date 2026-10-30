import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { aiGate } from '../_shared/ai-gate.ts'

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

// ── Feature allow-list (2026-10-30 security pass) ─────────────────
// Non-admin callers may only use the feature names the learner / tutor
// pages actually send (collected from every callClaude() in korehan/ —
// admin-page features are admin-only and never reach here for anyone
// else). An unknown feature is rejected, so a free account can't dodge
// the Premium gate below by renaming a feature. Add a name here when a
// new learner-facing callClaude() ships.
const LEARNER_FEATURES = new Set([
  // korehan-study-room.js
  'study-room-daily', 'study-room', 'topic-common-mistakes', 'phrase-munch',
  'key-expressions', 'key-expr-situation-quiz', 'ke-situations-prefetch', 'ke-situations',
  'speaking_feedback', 'daily_package_feedback', 'unified_writing_feedback',
  'study_room_picture_description', 'beginner-sentences', 'word-snap-translate',
  'grammar-curriculum', 'grammar-focus', 'weak-grammar-drill', 'gf-judge-gen',
  'dictation-gen', 'nuance-quiz-gen', 'translation',
  // korehan-phrase.html / korehan-learning-overview.html
  'phrase-content-fill', 'monthly-plan',
  // korehan-shared.js
  'title-en', 'review-tf', 'grammar', 'inline-vocab-autofill', 'curriculum-tag',
  // js/features/*.js
  'article-analyze', 'summary-check', 'quiz', 'translate',
  // korehan-tutor-7v3ca.html (text only)
  'tutor-feedback',
])

// AI features only Premium (Premium Live, and legacy standard / pro) accounts
// may call — mirrors js/core/plans.js (writing_feedback / writing_ai_feedback /
// speaking_feedback are not in the Free plan). Checked with kh_is_premium()
// on the server; the feature name itself is pinned by LEARNER_FEATURES.
const PREMIUM_ONLY_FEATURES = new Set([
  'daily_package_feedback', 'unified_writing_feedback', 'speaking_feedback',
])

// ── Model allow-list ─────────────────────────────────────────────
// Only the models the app sends. Anything else is a 400 (it used to be
// forwarded and billed at a guessed price). Opus is admin-only
// (grammar-pdf-parse in the admin CMS).
const LEARNER_MODELS = new Set(['claude-haiku-4-5-20251001', 'claude-haiku-4-5', 'claude-sonnet-4-6'])
const ADMIN_MODELS = new Set([...LEARNER_MODELS, 'claude-opus-4-6', 'claude-opus-4-7'])

// ── Output caps ──────────────────────────────────────────────────
// Learner calls ask for ≤2,500 tokens except the article translation
// (8,192). Admin generators (Fast Track scenarios, conversation analysis)
// ask for up to 16,000, so admins keep the 16K ceiling.
const LEARNER_MAX_TOKENS = 4096
const LEARNER_MAX_TOKENS_BY_FEATURE: Record<string, number> = { 'translate': 8192 }

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
// cap for weeks. Most learner AI output is cached in the DB and shared,
// so measured learner spend is cents per month (2026-10 report); the caps
// only stop runaway use. Premium stays below its $8.99 price so one
// account can never cost more than it pays.
const FREE_DAILY_CALLS    = 30
const FREE_MONTHLY_USD    = 1
const STANDARD_DAILY_CALLS  = 200
const STANDARD_MONTHLY_USD  = 6
// Pro: bypass cost ceiling, keep a generous burst limit so a single
// runaway script can't drain the account.
const PRO_DAILY_CALLS     = 1000
const PRO_MONTHLY_USD     = 500

// Anthropic published prices in USD per 1M tokens.
// Unknown models default to Sonnet pricing — conservative over-count
// is preferred over an under-charge that hides budget burn.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':                 { input: 15.00, output: 75.00 },
  'claude-opus-4-6':                 { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514':        { input:  3.00, output: 15.00 },
  'claude-sonnet-4-6':               { input:  3.00, output: 15.00 },
  'claude-3-sonnet-20240229':        { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':       { input:  0.80, output:  4.00 },
  'claude-haiku-4-5':                { input:  0.80, output:  4.00 },
}
const DEFAULT_PRICING = { input: 3.00, output: 15.00 }

// Per-call max output for admins. A buggy/hostile client can't request a
// 200K completion in one shot. Fast Track scenario generation needs
// ~10-12K tokens for 25-node JSON, so the admin cap sits at 16K.
// Learners use LEARNER_MAX_TOKENS above.
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
// function billed alive. Set to 140s: the article-generation calls
// (cold-cache Sonnet body + verbose Haiku per-sentence analysis, 6–8k
// output tokens) can exceed 90s on a cache-cold first run — owner saw
// "AI timeout" on a single low-difficulty article. 140s aborts cleanly
// just under Supabase's ~150s edge wall-clock limit.
const ANTHROPIC_TIMEOUT_MS = 140_000

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

// ── Request body sanitising ──────────────────────────────────────
// The upstream body is rebuilt from these fields only (model, max_tokens,
// messages, system, temperature). tools / tool_choice / stream / metadata /
// thinking / anything else the client sends is dropped.
type Block = Record<string, unknown>
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

function cleanTextBlock(b: Block): Block | null {
  if (typeof b.text !== 'string') return null
  const out: Block = { type: 'text', text: b.text }
  const cc = b.cache_control as { type?: unknown } | undefined
  if (cc && typeof cc === 'object' && cc.type === 'ephemeral') out.cache_control = { type: 'ephemeral' }
  return out
}

function cleanBlocks(raw: unknown, allowImages: boolean, allowDocs: boolean): { blocks?: Block[]; images: number; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return { images: 0, error: 'bad content blocks' }
  const blocks: Block[] = []
  let images = 0
  for (const b of raw as Block[]) {
    if (!b || typeof b !== 'object') return { images, error: 'bad content block' }
    if (b.type === 'text') {
      const t = cleanTextBlock(b)
      if (!t) return { images, error: 'bad text block' }
      blocks.push(t)
    } else if (b.type === 'image' && allowImages) {
      const src = b.source as { type?: unknown; media_type?: unknown; data?: unknown } | undefined
      if (!src || src.type !== 'base64' || typeof src.data !== 'string' || !IMAGE_TYPES.has(String(src.media_type))) {
        return { images, error: 'bad image block' }
      }
      blocks.push({ type: 'image', source: { type: 'base64', media_type: src.media_type, data: src.data } })
      images += 1
    } else if (b.type === 'document' && allowDocs) {
      blocks.push(b) // admin only (PDF parsing)
    } else {
      return { images, error: `content block type not allowed: ${String(b.type).slice(0, 20)}` }
    }
  }
  return { blocks, images }
}

function cleanMessages(raw: unknown, allowImages: boolean, allowDocs: boolean): { messages?: Block[]; images: number; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return { images: 0, error: 'messages must be a non-empty array' }
  const out: Block[] = []
  let images = 0
  for (const m of raw as Block[]) {
    if (!m || typeof m !== 'object' || (m.role !== 'user' && m.role !== 'assistant')) {
      return { images, error: 'bad message role' }
    }
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
    } else {
      const r = cleanBlocks(m.content, allowImages, allowDocs)
      if (r.error) return { images, error: r.error }
      images += r.images
      out.push({ role: m.role, content: r.blocks })
    }
  }
  return { messages: out, images }
}

function cleanSystem(raw: unknown): { system?: unknown; error?: string } {
  if (raw === undefined || raw === null) return {}
  if (typeof raw === 'string') return { system: raw }
  if (Array.isArray(raw) && raw.length > 0 && raw.length <= 10) {
    const blocks: Block[] = []
    for (const b of raw as Block[]) {
      const t = b && typeof b === 'object' && b.type === 'text' ? cleanTextBlock(b) : null
      if (!t) return { error: 'bad system block' }
      blocks.push(t)
    }
    return { system: blocks }
  }
  return { error: 'bad system' }
}

// Rough input-token estimate for the quota reservation (reconciled with the
// real usage after the call): ~1 token per 3 UTF-8 bytes of text (Korean is
// 3 bytes/char ≈ 1 token; English over-counts a little), ~1,600 per image.
function estimateInputTokens(textBytes: number, images: number) {
  return Math.ceil(textBytes / 3) + images * 1600
}

// KST windows for the legacy (pre-migration) quota path.
function kstWindows() {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const nowKstMs = Date.now() + KST_OFFSET_MS
  const dayStart = new Date(Math.floor(nowKstMs / 86_400_000) * 86_400_000 - KST_OFFSET_MS)
  const kstNow = new Date(nowKstMs)
  const monthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1) - KST_OFFSET_MS)
  return { dayStart, monthStart }
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

    // ── 4. Body + parameter sanitization ─────────────────────────
    // Done before any quota work so a rejected request never reserves.
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    const feature = body.feature
    // Capped: it lands verbatim in claude_api_usage.
    const featureStr = (typeof feature === 'string' && feature.length) ? feature.slice(0, 64) : null

    // Tutor large-payload carve-out. The Preply screenshot importer sends
    // 1–5 base64 images per request; even one resized 1600px PNG is well
    // past the 80 KB default cap. Tutors are identified by hardcoded
    // email allowlist (mirrors is_tutor_user RPC + KH_TUTOR_EMAILS).
    // The carve-out ONLY applies to features that prefix-match
    // TUTOR_LARGE_PAYLOAD_PREFIXES, so a tutor's regular learning-flow
    // calls still hit the standard cap.
    const isTutor = !isAdmin
      && !!userData.email
      && TUTOR_EMAILS.includes(String(userData.email).toLowerCase())
    const featureIsTutorLarge = !!featureStr
      && TUTOR_LARGE_PAYLOAD_PREFIXES.some((p) => featureStr.startsWith(p))

    // Feature allow-list (admins may use any feature name).
    if (!isAdmin) {
      const known = !!featureStr && (LEARNER_FEATURES.has(featureStr) || (isTutor && featureIsTutorLarge))
      if (!known) {
        return jsonResponse({ error: 'Unknown AI feature', code: 'feature_not_allowed' }, 400, cors)
      }
    }

    // Model allow-list.
    const model = typeof body.model === 'string' ? body.model : ''
    if (!(isAdmin ? ADMIN_MODELS : LEARNER_MODELS).has(model)) {
      return jsonResponse({ error: 'Model not allowed', code: 'model_not_allowed' }, 400, cors)
    }

    // max_tokens: integer, capped per caller / feature.
    const maxCap = isAdmin
      ? MAX_TOKENS_PER_CALL
      : (featureStr && LEARNER_MAX_TOKENS_BY_FEATURE[featureStr]) || LEARNER_MAX_TOKENS
    let maxTokens = typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)
      ? Math.floor(body.max_tokens) : 1024
    if (maxTokens < 1) maxTokens = 1
    if (maxTokens > maxCap) maxTokens = maxCap

    const allowImages = isAdmin || (isTutor && featureIsTutorLarge)
    const cleaned = cleanMessages(body.messages, allowImages, isAdmin)
    if (cleaned.error) return jsonResponse({ error: cleaned.error, code: 'bad_request' }, 400, cors)
    const sys = cleanSystem(body.system)
    if (sys.error) return jsonResponse({ error: sys.error, code: 'bad_request' }, 400, cors)

    const claudeBody: Record<string, unknown> = { model, max_tokens: maxTokens, messages: cleaned.messages }
    if (sys.system !== undefined) claudeBody.system = sys.system
    if (typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 1) {
      claudeBody.temperature = body.temperature
    }

    // Input size cap — protects the monthly cost budget from a single
    // request stuffing 200K tokens into messages. Admins bypass since
    // article-cache regeneration legitimately approaches this ceiling.
    // Verified tutors on tutor-only features get a higher cap for the
    // image-OCR flows (TUTOR_MAX_INPUT_BYTES).
    const inputBytes = new TextEncoder().encode(
      JSON.stringify(claudeBody.messages) + (sys.system !== undefined ? JSON.stringify(sys.system) : ''),
    ).length
    if (!isAdmin) {
      const cap = (isTutor && featureIsTutorLarge) ? TUTOR_MAX_INPUT_BYTES : MAX_INPUT_BYTES
      if (inputBytes > cap) {
        return jsonResponse({
          error: 'Input too large',
          detail: `Request is ${Math.round(inputBytes / 1024)}KB; per-call limit is ${Math.round(cap / 1024)}KB.`,
          code: 'input_too_large',
        }, 413, cors)
      }
    }

    // ── 5. Owner switches (admin → AI costs) ──────────────────────
    const off = await aiGate(sb, 'site', featureStr, { admin: isAdmin })
    if (off) return jsonResponse({ error: off, code: 'ai_off' }, 503, cors)

    // ── 6. Premium gate + quota reservation ──────────────────────
    // The reservation row is written BEFORE the upstream call: kh_ai_reserve
    // takes a per-user advisory lock, checks the daily count + monthly USD,
    // and inserts a claude_api_usage row priced at this call's worst case
    // (estimated input + full max_tokens). Parallel requests therefore see
    // each other's reservations and can't overshoot the caps. The row is
    // reconciled to the real usage after the call.
    let reservationId: number | null = null
    let legacyLog = false
    if (!isAdmin) {
      if (featureStr && PREMIUM_ONLY_FEATURES.has(featureStr)) {
        const { data: prem, error: premErr } = await sb.rpc('kh_is_premium', { p_user: userId })
        if (premErr) {
          console.error('[claude-proxy] kh_is_premium failed:', premErr.message)
          return jsonResponse({ error: 'Plan check failed, please retry' }, 503, cors)
        }
        if (prem !== true) {
          return jsonResponse({ error: 'Premium feature', code: 'premium_required' }, 403, cors)
        }
      }

      // Plan resolution for the limits. Source of truth is user_subscriptions
      // (written by billing-webhook): an active, unexpired premium or
      // premium_live row gets the Premium limits (Premium Live = Premium +
      // live class, same AI access); legacy standard / pro rows keep their
      // own. Override row in user_quota_overrides wins over plan defaults.
      let dailyCallLimit  = FREE_DAILY_CALLS
      let monthlyUsdLimit = FREE_MONTHLY_USD
      try {
        const { data: sub } = await sb
          .from('user_subscriptions')
          .select('plan, status, expires_at')
          .eq('user_id', userId)
          .maybeSingle()
        const live = sub && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date())
        const plan = live ? String(sub.plan || 'free') : 'free'
        if (plan === 'premium' || plan === 'premium_live' || plan === 'standard') {
          dailyCallLimit  = STANDARD_DAILY_CALLS
          monthlyUsdLimit = STANDARD_MONTHLY_USD
        } else if (plan === 'pro') {
          dailyCallLimit  = PRO_DAILY_CALLS
          monthlyUsdLimit = PRO_MONTHLY_USD
        }
      } catch (_) { /* keep free defaults */ }

      const { data: override } = await sb
        .from('user_quota_overrides')
        .select('daily_call_limit, monthly_cost_limit_usd')
        .eq('user_id', userId)
        .maybeSingle()
      if (override?.daily_call_limit) dailyCallLimit = override.daily_call_limit
      if (override?.monthly_cost_limit_usd != null) monthlyUsdLimit = Number(override.monthly_cost_limit_usd)

      const limitResponse = (code: string, callsToday: number, monthlyUsd: number) => {
        const quota = { callsToday, dailyCallLimit, monthlyUsd: Math.round(monthlyUsd * 100) / 100, monthlyUsdLimit }
        if (code === 'daily_call_limit') {
          return jsonResponse({
            error: 'Daily AI limit reached',
            detail: `Daily limit ${dailyCallLimit} calls. Resets at KST midnight.`,
            quota, code,
          }, 429, cors)
        }
        return jsonResponse({
          error: 'Monthly AI usage limit reached',
          detail: `You've used $${monthlyUsd.toFixed(2)} of your $${monthlyUsdLimit} monthly AI budget. Upgrade for higher limits.`,
          quota, code: 'monthly_cost_limit',
        }, 429, cors)
      }

      const { data: resv, error: resvErr } = await sb.rpc('kh_ai_reserve', {
        p_user: userId,
        p_feature: featureStr,
        p_model: model,
        p_est_input: estimateInputTokens(inputBytes, cleaned.images),
        p_est_output: maxTokens,
        p_daily_limit: dailyCallLimit,
        p_monthly_usd: monthlyUsdLimit,
        p_prices: { ...MODEL_PRICING, _default: DEFAULT_PRICING },
      })
      const missingFn = !!resvErr && (resvErr.code === 'PGRST202' || resvErr.code === '42883')
      if (resvErr && !missingFn) {
        console.error('[claude-proxy] kh_ai_reserve failed:', resvErr.message)
        return jsonResponse({ error: 'Quota check failed, please retry' }, 503, cors)
      }
      if (!resvErr) {
        const r = resv as { ok?: boolean; id?: number; code?: string; calls_today?: number; monthly_usd?: number } | null
        if (!r || !r.ok || r.id == null) {
          return limitResponse(String(r?.code || 'daily_call_limit'), Number(r?.calls_today || 0), Number(r?.monthly_usd || 0))
        }
        reservationId = Number(r.id)
      } else {
        // Migration 20261030_ai_quota_reserve.sql not applied yet (edge
        // functions and migrations deploy from separate workflows). Fall
        // back to the old read-then-log check so AI keeps working.
        legacyLog = true
        const { dayStart, monthStart } = kstWindows()
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
        if (callsToday >= dailyCallLimit) return limitResponse('daily_call_limit', callsToday, monthlyUsd)
        if (monthlyUsd >= monthlyUsdLimit) return limitResponse('monthly_cost_limit', callsToday, monthlyUsd)
      }
    }

    // Writes the final usage figures: updates the reservation row, or inserts
    // a row (admins, legacy path). Awaited so the figures land before the
    // function instance can be frozen.
    const recordUsage = async (inputTokens: number, outputTokens: number) => {
      if (reservationId !== null) {
        const { error } = await sb.from('claude_api_usage')
          .update({ input_tokens: inputTokens, output_tokens: outputTokens })
          .eq('id', reservationId)
        if (error) console.error('[claude-proxy] usage reconcile failed:', error.message)
      } else if (isAdmin || legacyLog) {
        const { error } = await sb.from('claude_api_usage').insert({
          user_id: userId, feature: featureStr, model,
          input_tokens: inputTokens, output_tokens: outputTokens,
        })
        if (error) console.error('[claude-proxy] usage insert failed:', error.message)
      }
    }

    // ── 7. Anthropic call with timeout ───────────────────────────
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), ANTHROPIC_TIMEOUT_MS)
    let response: Response
    try {
      // Detect whether the client wants prompt caching — any content
      // block that carries a cache_control field signals intent. Caching
      // is GA on Claude 4.x but sending the explicit beta header is a
      // no-op when not needed, so we send it whenever requested.
      let wantsPromptCaching = false
      for (const m of (cleaned.messages || [])) {
        const content = (m as { content?: unknown }).content
        if (Array.isArray(content) && content.some((b) => !!b && typeof b === 'object' && 'cache_control' in b)) {
          wantsPromptCaching = true
          break
        }
      }
      if (Array.isArray(sys.system) && (sys.system as Block[]).some((b) => 'cache_control' in b)) {
        wantsPromptCaching = true
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
      // A timed-out call may still have been billed, so a reservation keeps
      // its worst-case estimate; a call that never connected costs 0.
      if (!aborted || reservationId === null) await recordUsage(0, 0)
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
      await recordUsage(0, 0)
      return jsonResponse({ error: 'Bad response from AI service' }, 502, cors)
    }

    // ── 8. Record usage ──────────────────────────────────────────
    // EVERY call keeps its row — including failures — so the daily counter
    // can't be gamed by deliberately producing 4xx/5xx responses. Token
    // counts are 0 for non-200 paths since Anthropic didn't bill us.
    //
    // Prompt caching: Anthropic returns three input figures when the
    // request uses cache_control — input_tokens (non-cached portion),
    // cache_creation_input_tokens (1.25x cost), cache_read_input_tokens
    // (0.1x cost). The monthly-cost computation only reads input_tokens,
    // so the cache portions are folded into it using their pricing weights.
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
    await recordUsage(
      response.ok ? effectiveInput : 0,
      response.ok ? (usage?.output_tokens ?? 0) : 0,
    )

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
