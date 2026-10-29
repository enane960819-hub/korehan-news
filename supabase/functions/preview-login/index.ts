// preview-login — owner's temporary "signed-in + Premium" preview without
// typing credentials (2026-10-29: testing on a work computer where the
// owner must not sign in to their own account).
//
// The link korehani.com/?kh_preview=<token> posts the token here. If its
// SHA-256 matches app_settings.preview_login (server-only key, never in the
// client allow-list) and it hasn't expired, we sign the browser in as a
// dedicated preview account — not the owner, not an admin — with Premium
// until the same expiry. Revoke: delete the app_settings row (no new
// sessions) — Premium on the account ends at expires_at either way.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

let corsHeaders: Record<string, string> = {}
function setCors(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ['https://korehani.com', 'https://www.korehani.com', 'https://korehannews.com', 'https://www.korehannews.com', 'http://localhost:8765']
  corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let token = ''
  try { token = String((await req.json())?.token || '') } catch (_) { /* empty */ }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ error: 'invalid' }, 403)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: row } = await admin.from('app_settings').select('value').eq('key', 'preview_login').maybeSingle()
  let cfg: any = null
  try { cfg = row?.value ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : null } catch (_) { cfg = null }
  if (!cfg || cfg.enabled === false || !cfg.token_sha256 || !cfg.email) return json({ error: 'invalid' }, 403)
  const expires = new Date(cfg.expires_at || 0)
  if (!(expires.getTime() > Date.now())) return json({ error: 'expired' }, 403)
  if (!sameHex(await sha256Hex(token), String(cfg.token_sha256))) return json({ error: 'invalid' }, 403)

  const email = String(cfg.email)
  // The preview account is created on first use (already-registered is fine).
  await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: 'Preview' } }).catch(() => null)

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const hashed = (link.data as any)?.properties?.hashed_token
  const userId = (link.data as any)?.user?.id
  if (link.error || !hashed || !userId) return json({ error: 'link_failed' }, 500)

  // Premium until the preview expires.
  const sub = await admin.from('user_subscriptions').upsert({
    user_id: userId, plan: 'premium', status: 'active', expires_at: expires.toISOString(),
    payment_provider: 'preview', updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (sub.error) return json({ error: 'plan_failed' }, 500)

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const v = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: hashed })
  const s = v.data?.session
  if (v.error || !s) return json({ error: 'session_failed' }, 500)
  return json({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: expires.toISOString() })
})
