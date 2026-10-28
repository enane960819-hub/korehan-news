// cache-write — the only way a reader's browser can save to a shared AI cache.
//
// Readers' devices still make the AI call (one per article / pattern, ever),
// but the result is saved here with the service role, so readers have no
// write access to article_cache / grammar_examples_cache at all
// (20261028_cache_write_server_only.sql). Rules:
//   - signed-in users only; at most WRITES_PER_HOUR saves per user (admin exempt)
//   - fill-only: a slot that already holds real content is never replaced
//     (vocab with < 5 items and other slots with < 2 items count as thin and
//     may be refilled; translation.texts may only grow)
//   - shape + size checks per slot; article must exist and be published
//   - every save is stamped with written_by and enters the content-qa queue
//     (qa_at is null on insert; the requeue trigger clears it on update)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const WRITES_PER_HOUR = 120
const MAX_FIELD_BYTES = 200_000

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
// Number of items in a cached value: array length, or the summed length of
// an object's top-level arrays ({patterns:[…]}, {lessons:[…]}, …).
function itemCount(v: any): number {
  if (Array.isArray(v)) return v.length
  if (v && typeof v === 'object') {
    let n = 0
    for (const k of Object.keys(v)) if (Array.isArray(v[k])) n += v[k].length
    return n
  }
  return 0
}
const isObj = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max

// Shape checks for article_cache slots (value already parsed).
const ARTICLE_SLOTS: Record<string, (v: any) => boolean> = {
  vocab: (v) => Array.isArray(v) && v.length > 0 && v.length <= 80 &&
    v.every((i) => isObj(i) && (str(i.word, 60) || str(i.ko, 60))),
  grammar: (v) => isObj(v) && Array.isArray(v.patterns) && v.patterns.length > 0 && v.patterns.length <= 20 &&
    v.patterns.every(isObj),
  quiz: (v) => isObj(v) && Array.isArray(v.questions) && v.questions.length > 0 && v.questions.length <= 30 &&
    v.questions.every(isObj),
  tf_v1: (v) => isObj(v) && Array.isArray(v.items) && v.items.length > 0 && v.items.length <= 10 &&
    v.items.every((i: any) => isObj(i) && str(i.sentence, 400) && typeof i.truth === 'boolean'),
  translation: (v) => isObj(v) && Array.isArray(v.texts) && v.texts.length > 0 && v.texts.length <= 300 &&
    v.texts.every((t: unknown) => typeof t === 'string' && t.length <= 8000),
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
  const sb = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get('Authorization') || ''
  const check = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } })
  const user = check.ok ? await check.json().catch(() => null) : null
  if (!user?.id) return json({ ok: false, error: 'not_signed_in' }, 401)
  const isAdmin = user.email === ADMIN_EMAIL

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_request' }, 400)

  if (!isAdmin) {
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await sb.from('cache_write_log').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since)
    if ((count || 0) >= WRITES_PER_HOUR) return json({ ok: false, error: 'rate_limited' }, 429)
  }
  const logWrite = (tbl: string, key: string) =>
    sb.from('cache_write_log').insert({ user_id: user.id, tbl, cache_key: key.slice(0, 200) }).then(() => {}, () => {})

  // ── article_cache: { table, article_id, patch: { slot: value } } ──
  if (body.table === 'article_cache') {
    const articleId = String(body.article_id || '').trim()
    if (!articleId || articleId.length > 100 || !isObj(body.patch)) return json({ ok: false, error: 'bad_request' }, 400)
    const { data: art } = await sb.from('articles').select('id, status').eq('id', articleId).maybeSingle()
    if (!art || (art.status !== 'published' && !isAdmin)) return json({ ok: false, error: 'not_found' }, 404)

    const { data: cur } = await sb.from('article_cache').select('vocab, grammar, quiz, tf_v1, translation').eq('article_id', articleId).maybeSingle()
    const row: Record<string, string> = {}
    const written: string[] = [], skipped: string[] = []
    for (const slot of Object.keys(body.patch)) {
      const check = ARTICLE_SLOTS[slot]
      const raw = body.patch[slot]
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      const val = parseMaybe(raw)
      if (!check || !text || text.length > MAX_FIELD_BYTES || !check(val)) { skipped.push(slot); continue }
      const old = parseMaybe((cur as any)?.[slot])
      if (slot === 'translation') {
        // Readers only add paragraph translations; sentence analysis comes
        // from article-analyze and is kept as is.
        const oldTexts = Array.isArray(old?.texts) ? old.texts : []
        if (val.texts.length <= oldTexts.length) { skipped.push(slot); continue }
        row.translation = JSON.stringify({ ...(isObj(old) ? old : {}), texts: val.texts })
      } else {
        const thin = slot === 'vocab' ? itemCount(old) < 5 : itemCount(old) < 2
        if (!thin) { skipped.push(slot); continue }
        row[slot] = text
      }
      written.push(slot)
    }
    if (!written.length) return json({ ok: true, written, skipped })
    const { error } = await sb.from('article_cache')
      .upsert({ article_id: articleId, ...row, written_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'article_id' })
    if (error) return json({ ok: false, error: 'write_failed', detail: error.message }, 500)
    logWrite('article_cache', articleId + ':' + written.join(','))
    return json({ ok: true, written, skipped })
  }

  // ── grammar_examples_cache: { table, pattern_name, patterns_json } ──
  if (body.table === 'grammar_examples_cache') {
    const key = String(body.pattern_name || '')
    const text = typeof body.patterns_json === 'string' ? body.patterns_json : JSON.stringify(body.patterns_json ?? null)
    const val = parseMaybe(text)
    if (!key || key.length > 200 || /[\n\r]/.test(key) || !text || text.length > MAX_FIELD_BYTES || itemCount(val) < 1) {
      return json({ ok: false, error: 'bad_request' }, 400)
    }
    const { data: cur } = await sb.from('grammar_examples_cache').select('patterns_json').eq('pattern_name', key).maybeSingle()
    if (cur && itemCount(parseMaybe(cur.patterns_json)) >= 2 && !isAdmin) return json({ ok: true, written: [], skipped: [key] })
    const { error } = await sb.from('grammar_examples_cache')
      .upsert({ pattern_name: key, patterns_json: text, written_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'pattern_name' })
    if (error) return json({ ok: false, error: 'write_failed', detail: error.message }, 500)
    logWrite('grammar_examples_cache', key)
    return json({ ok: true, written: [key], skipped: [] })
  }

  return json({ ok: false, error: 'bad_table' }, 400)
})
