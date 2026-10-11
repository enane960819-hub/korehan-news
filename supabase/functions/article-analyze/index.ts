// article-analyze — first signed-in reader bakes an article's sentence
// analysis for everyone.
//
// The reader (korehan-shared.js analyzeSentence) calls this when a tapped
// sentence has no cached analysis. We generate the whole article once with
// the same prompt the daily drafts use, store it in article_cache with the
// service role (readers can't write that table), and return it. Every later
// reader reads the cache — no AI call.
//
// Guards (article_analyze_log, see 20261012_article_analyze_log.sql):
//   - one bake per article at a time (partial unique index on 'running')
//   - an article that already has sentences is never re-generated here
//   - PER_USER_DAILY bakes per user / SITE_DAILY bakes site-wide per 24h
//     (admin exempt), so a bug or abuse can't drain the API balance.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  analysisPrompt, deriveTabs, extractJsonObject, type Level, SENT_CACHE_VERSION, stitchSentences,
} from '../_shared/article-analysis.ts'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const MODEL = 'claude-haiku-4-5-20251001'
const PER_USER_DAILY = 5
const SITE_DAILY = 60
const STALE_RUN_MS = 5 * 60 * 1000
const LEVELS: Level[] = ['Starter', 'Beginner', 'Intermediate', 'Advanced']

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

function parseMaybe(v: unknown): any {
  if (v == null) return null
  if (typeof v === 'object') return v
  try { return JSON.parse(String(v)) } catch (_) { return null }
}
function hasSentences(t: any): boolean {
  return !!(t && Array.isArray(t.sentences) && t.sentences.length)
}

async function callClaude(sb: any, apiKey: string, content: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 130_000)
  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    })
  } finally { clearTimeout(timer) }
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null)
    throw new Error(`Anthropic ${resp.status}` + (errBody?.error?.message ? ': ' + String(errBody.error.message).slice(0, 200) : ''))
  }
  const data = await resp.json()
  const u = data.usage || {}
  sb.from('claude_api_usage').insert({
    user_id: null, feature: 'article-analyze', model: MODEL,
    input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    output_tokens: u.output_tokens || 0,
  }).then(() => {}, () => {})
  return (data.content || []).map((c: { text?: string }) => c.text || '').join('')
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
  const sb = createClient(supabaseUrl, serviceKey)

  // Signed-in readers only (gateway JWT check is off for CORS preflight;
  // we verify the token here).
  const authHeader = req.headers.get('Authorization') || ''
  const check = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } })
  const user = check.ok ? await check.json().catch(() => null) : null
  if (!user?.id) return json({ ok: false, error: 'not_signed_in' }, 401)
  const isAdmin = user.email === ADMIN_EMAIL

  const reqBody = await req.json().catch(() => ({}))
  const articleId = String(reqBody?.article_id || '').trim()
  if (!articleId || articleId.length > 100) return json({ ok: false, error: 'invalid_article' }, 400)

  const { data: art } = await sb.from('articles').select('id, title, body, level, status').eq('id', articleId).maybeSingle()
  if (!art || !art.body || (art.status !== 'published' && !isAdmin)) return json({ ok: false, error: 'not_found' }, 404)

  // Already baked → hand it back (no AI call).
  const { data: cacheRow } = await sb.from('article_cache').select('translation, vocab, grammar').eq('article_id', articleId).maybeSingle()
  const existing = parseMaybe(cacheRow?.translation)
  if (hasSentences(existing)) return json({ ok: true, cached: true, translation: existing })

  // Budget guards.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  if (!isAdmin) {
    const { count: mine } = await sb.from('article_analyze_log').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('status', ['running', 'done']).gte('created_at', since)
    if ((mine || 0) >= PER_USER_DAILY) return json({ ok: false, error: 'daily_limit', limit: PER_USER_DAILY }, 429)
    const { count: site } = await sb.from('article_analyze_log').select('id', { count: 'exact', head: true })
      .in('status', ['running', 'done']).gte('created_at', since)
    if ((site || 0) >= SITE_DAILY) return json({ ok: false, error: 'site_limit' }, 429)
  }

  // An article whose bake keeps failing (e.g. an odd body) stops costing
  // calls after two tries a day; admin can still retry.
  if (!isAdmin) {
    const { count: fails } = await sb.from('article_analyze_log').select('id', { count: 'exact', head: true })
      .eq('article_id', articleId).eq('status', 'failed').gte('created_at', since)
    if ((fails || 0) >= 2) return json({ ok: false, error: 'generation_failed' }, 503)
  }

  // Per-article lock. A crashed run older than STALE_RUN_MS is released first.
  await sb.from('article_analyze_log').update({ status: 'failed', error: 'stale', finished_at: new Date().toISOString() })
    .eq('article_id', articleId).eq('status', 'running').lt('created_at', new Date(Date.now() - STALE_RUN_MS).toISOString())
  const { data: lock, error: lockErr } = await sb.from('article_analyze_log')
    .insert({ article_id: articleId, user_id: user.id }).select('id').single()
  if (lockErr || !lock) return json({ ok: false, error: 'in_progress' }, 409)

  const finish = (status: 'done' | 'failed', error?: string) =>
    sb.from('article_analyze_log').update({ status, error: error || null, finished_at: new Date().toISOString() }).eq('id', lock.id)

  try {
    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) throw new Error('No Anthropic API key in app_settings')

    const level: Level = LEVELS.includes(art.level) ? art.level : 'Beginner'
    const raw = await callClaude(sb, apiKey, analysisPrompt(art.title || '', art.body, level), 8000)
    const parsed = extractJsonObject(raw)
    const rawSents: any[] = Array.isArray(parsed?.sentences) ? parsed.sentences : []
    const sentences = stitchSentences(art.body, rawSents)
    const filled = sentences.filter((s) => s.translation || s.vocab.length || s.analysis.length).length
    // Same bar as the reader's old bulk path: a truncated reply must not be
    // cached as if complete (later readers would never re-bake it).
    if (!sentences.length || filled < Math.floor(sentences.length * 0.8)) {
      throw new Error(`incomplete analysis (${filled}/${sentences.length})`)
    }

    // Keep paragraph translations that may already be in the row.
    const translation = { ...(existing && typeof existing === 'object' ? existing : {}), sentences, version: SENT_CACHE_VERSION }
    const row: Record<string, string> = { translation: JSON.stringify(translation) }
    const tabs = deriveTabs(sentences, level)
    if (!parseMaybe(cacheRow?.vocab)?.length && tabs.vocab.length) row.vocab = JSON.stringify(tabs.vocab)
    if (!parseMaybe(cacheRow?.grammar)?.patterns?.length && tabs.grammar.patterns.length) row.grammar = JSON.stringify(tabs.grammar)

    const { error: upErr } = await sb.from('article_cache').upsert({ article_id: articleId, ...row }, { onConflict: 'article_id' })
    if (upErr) throw new Error('cache write: ' + upErr.message)

    await finish('done')
    return json({ ok: true, cached: false, translation })
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300)
    console.error('[article-analyze]', articleId, msg)
    await finish('failed', msg)
    await sb.from('client_errors').insert({
      message: 'article-analyze: ' + msg, severity: 'error',
      context: { source: 'article-analyze', article_id: articleId }, user_agent: 'edge-function',
    }).then(() => {}, () => {})
    return json({ ok: false, error: 'generation_failed' }, 500)
  }
})
