// ══════════════════════════════════════════════════════════════════════
// newsletter-unsubscribe — handles both:
//
//   GET  /functions/v1/newsletter-unsubscribe?t=<token>
//        → 302 to /unsubscribe.html?t=<token> so the browser-facing
//          page can show a friendly confirmation. The actual RPC
//          call still happens client-side on that page.
//
//   POST /functions/v1/newsletter-unsubscribe?t=<token>
//        Content-Type: application/x-www-form-urlencoded
//        Body: List-Unsubscribe=One-Click
//
//        RFC 8058 one-click unsubscribe — Gmail / Yahoo / Apple Mail
//        in their bulk-sender rules (Feb 2024) require BOTH the
//        List-Unsubscribe URL header AND a working POST endpoint
//        that immediately unsubscribes without the user needing to
//        click through. Without this, sender reputation tanks
//        regardless of whether the URL is reachable.
//
//        We call newsletter_unsubscribe RPC immediately and return
//        200 with no body. Idempotent — re-POST with same token is
//        a no-op.
//
// Public endpoint (no JWT required) — token is the authentication.
// ══════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE_BASE = 'https://korehani.com'

// Wide CORS — this is a public unsubscribe endpoint, called from
// mail clients which don't have an origin to match. Vary:Origin so
// caches still split correctly.
const CORS_PERMISSIVE: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Vary': 'Origin',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_PERMISSIVE })

  try {
    const url = new URL(req.url)
    let token = (url.searchParams.get('t') || '').trim()

    // For RFC 8058 POSTs the token can also arrive in the body. Be
    // tolerant of either delivery so different mail clients work.
    if (req.method === 'POST' && !token) {
      try {
        const ct = (req.headers.get('content-type') || '').toLowerCase()
        if (ct.includes('application/x-www-form-urlencoded')) {
          const text = await req.text()
          const form = new URLSearchParams(text)
          token = (form.get('t') || form.get('token') || '').trim()
        } else if (ct.includes('application/json')) {
          const j = await req.json().catch(() => ({}))
          token = String((j as Record<string, unknown>).t || (j as Record<string, unknown>).token || '').trim()
        }
      } catch (_) { /* ignore */ }
    }

    // Reject the namespaced test-token used by the admin "test send"
    // path — see newsletter-send/index.ts handleSendCampaign. Without
    // this guard, hitting the test email's unsubscribe link would
    // pass through to the RPC and either insert a junk row or error
    // in a way the user reads as "Link expired".
    if (token.startsWith('test-')) {
      if (req.method === 'GET') {
        return Response.redirect(`${SITE_BASE}/unsubscribe.html?t=${encodeURIComponent(token)}&test=1`, 302)
      }
      // POST: pretend it succeeded so the mail client doesn't retry.
      return new Response('ok (test)', { status: 200, headers: CORS_PERMISSIVE })
    }

    // GET → bounce to the friendly page. The client-side JS there
    // already calls the RPC + shows a confirmation. Keep the EF
    // logic out of the browser path so the existing UI stays the
    // source of truth.
    if (req.method === 'GET') {
      const target = token
        ? `${SITE_BASE}/unsubscribe.html?t=${encodeURIComponent(token)}`
        : `${SITE_BASE}/unsubscribe.html`
      return Response.redirect(target, 302)
    }

    if (req.method !== 'POST') {
      return new Response('method not allowed', { status: 405, headers: CORS_PERMISSIVE })
    }
    if (!token) {
      return new Response('missing token', { status: 400, headers: CORS_PERMISSIVE })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    // Token is the authentication. RPC is idempotent on second hit.
    const { error } = await sb.rpc('newsletter_unsubscribe', { p_token: token })
    if (error) {
      console.error('[newsletter-unsubscribe] rpc error:', error.message)
      // Still return 200 — the mail client's one-click flow doesn't
      // retry on 4xx/5xx, and we'd rather the user perceive "done"
      // than have Gmail flag the sender. The error is in our logs.
      return new Response('logged', { status: 200, headers: CORS_PERMISSIVE })
    }

    return new Response('unsubscribed', {
      status: 200,
      headers: { ...CORS_PERMISSIVE, 'Content-Type': 'text/plain' },
    })
  } catch (e) {
    console.error('[newsletter-unsubscribe] uncaught:', (e as Error).message)
    return new Response('error', { status: 500, headers: CORS_PERMISSIVE })
  }
})
