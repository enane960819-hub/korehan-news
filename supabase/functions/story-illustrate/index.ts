// story-illustrate — generates ONE storybook page illustration with OpenAI
// gpt-image-1, uploads it to the `story-illustrations` Storage bucket, and
// returns its public URL. Admin-only. Hotspot detection (mapping objects in
// the generated image to Korean vocab/expressions/emotions) is done
// separately by the admin via the existing claude-proxy vision call — this
// function has a single responsibility: prompt → image → stored URL.
//
// Request (POST):
//   { prompt: string, story_id: string|number, page_idx: number,
//     size?: '1024x1024'|'1536x1024'|'1024x1536', style_hint?: string }
// Response: { image_url: string, model: string }
//
// Owner provisioning (one-time):
//   1. app_settings row: key='openai_key', value=<OpenAI API key>
//   2. Storage bucket 'story-illustrations' (public read)
//
// Deploy: supabase functions deploy story-illustrate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://korehani.com',
  'https://www.korehani.com',
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
]

const ADMIN_EMAILS = ['enane960819@gmail.com']

const BUCKET = 'story-illustrations'
const OPENAI_TIMEOUT_MS = 120_000     // gpt-image-1 can take 30–90s
const MAX_PROMPT_CHARS = 4000
const ALLOWED_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto']

// A consistent picture-book art direction prepended to every page prompt so
// the illustrations across a story read as one cohesive storybook.
const STYLE_PREAMBLE =
  'Soft, warm children\'s storybook illustration. Hand-painted gouache / ' +
  'watercolour look, gentle lighting, rounded friendly shapes, cohesive ' +
  'muted palette, clear readable composition with a clear focal subject. ' +
  'No text, no letters, no speech bubbles, no watermark, no borders. ' +
  'Korean everyday-life setting. Scene: '

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
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function safeSeg(v: unknown): string {
  return String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'x'
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey

    // ── Auth: admin only ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401, cors)
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!authCheck.ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const userData = await authCheck.json()
    if (!userData?.id) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const isAdmin = !!(userData.email && ADMIN_EMAILS.includes(userData.email))
    if (!isAdmin) return jsonResponse({ error: 'Admin only' }, 403, cors)

    // ── Parse body ───────────────────────────────────────────────
    let body: { prompt?: string; story_id?: string | number; page_idx?: number; size?: string }
    try { body = await req.json() } catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, cors) }
    const rawPrompt = String(body.prompt || '').trim()
    if (!rawPrompt) return jsonResponse({ error: 'prompt required' }, 400, cors)
    const size = (body.size && ALLOWED_SIZES.includes(body.size)) ? body.size : '1536x1024'
    const prompt = (STYLE_PREAMBLE + rawPrompt).slice(0, MAX_PROMPT_CHARS)

    // ── OpenAI key from app_settings ─────────────────────────────
    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const { data: setting, error: settingErr } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_key')
      .maybeSingle()
    if (settingErr) {
      console.error('[story-illustrate] app_settings query failed:', settingErr.message)
      return jsonResponse({ error: 'Configuration unavailable' }, 503, cors)
    }
    const openaiKey = setting?.value
    if (!openaiKey) return jsonResponse({ error: 'openai_key not configured in app_settings' }, 500, cors)

    // ── Generate image (gpt-image-1) ─────────────────────────────
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS)
    let genResp: Response
    try {
      genResp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size }),
        signal: ctrl.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      const aborted = (e as Error).name === 'AbortError'
      console.error('[story-illustrate] openai fetch failed:', aborted ? 'timeout' : (e as Error).message)
      return jsonResponse({ error: aborted ? 'Image generation timed out' : 'Image generation failed' }, 504, cors)
    }
    clearTimeout(timer)
    if (!genResp.ok) {
      const txt = await genResp.text()
      console.error('[story-illustrate] openai non-ok:', genResp.status, txt.slice(0, 300))
      return jsonResponse({ error: 'OpenAI error', status: genResp.status, detail: txt.slice(0, 300) }, 502, cors)
    }
    const genJson = await genResp.json()
    const b64 = genJson?.data?.[0]?.b64_json
    if (!b64) return jsonResponse({ error: 'No image returned' }, 502, cors)

    // ── Upload to Storage ────────────────────────────────────────
    const bytes = b64ToBytes(b64)
    const path = `${safeSeg(body.story_id)}/${safeSeg(body.page_idx ?? 0)}-${Date.now()}.png`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    })
    if (upErr) {
      console.error('[story-illustrate] storage upload failed:', upErr.message)
      return jsonResponse({ error: 'Upload failed: ' + upErr.message }, 500, cors)
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
    return jsonResponse({ image_url: pub.publicUrl, model: 'gpt-image-1', size }, 200, cors)
  } catch (e) {
    console.error('[story-illustrate] uncaught:', (e as Error).message)
    return jsonResponse({ error: 'Internal error' }, 500, cors)
  }
})
