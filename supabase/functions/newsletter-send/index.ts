// Newsletter sender — anon-callable confirm flow + admin-only campaign send
// ============================================================================
// Two actions on one endpoint, dispatched on body.action:
//
//   "subscribe":
//     Anonymous. Body: { email, name?, source? }. Calls
//     newsletter_request_subscribe RPC to upsert a pending row + mint
//     a confirm token, then dispatches the confirmation email via
//     Resend. Returns { ok, status } regardless of email success so
//     a downed mailer doesn't 500 the public form.
//
//   "send_campaign":
//     Admin-only (allowlist by email). Body: { campaign_id }. Pulls
//     the campaign row, fans out to every confirmed subscriber, logs
//     each send to newsletter_sends with the Resend message id, and
//     flips the campaign to status='sent' when done.
//
// Secrets
//   RESEND_API_KEY     (preferred) — Supabase function env var
//   app_settings.resend_key (fallback) — same pattern as the Claude
//                       proxy uses for anthropic_key, so an admin can
//                       rotate without redeploying.
//
// Sender domain
//   from defaults to "KoreHani <hello@korehani.com>" — that domain
//   has to be verified in Resend before sends will succeed. The
//   admin can override per-campaign via newsletter_campaigns.from_email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://korehannews.com',
  'https://www.korehannews.com',
  'https://korehani.com',
  'https://www.korehani.com',
  'http://localhost:3000',
  'http://localhost:8888',
]
const ADMIN_EMAILS = ['enane960819@gmail.com']
const SITE_BASE = 'https://korehani.com'
// One-click POST endpoint per RFC 8058. Browser-clicked GET on this
// URL 302-redirects to /unsubscribe.html for the friendly page.
const UNSUB_ENDPOINT = `${Deno.env.get('SUPABASE_URL') || 'https://samghztrdvtxmrmawneu.supabase.co'}/functions/v1/newsletter-unsubscribe`
const DEFAULT_FROM = 'KoreHani <hello@korehani.com>'

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  }
  // CORS hardening — match the rest of the proxy fleet (3rd-audit F9).
  // Don't echo a default ACAO for unlisted origins so CDN-cached
  // responses can't leak across origins.
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function getResendKey(sb: ReturnType<typeof createClient>): Promise<string | null> {
  const envKey = Deno.env.get('RESEND_API_KEY')
  if (envKey) return envKey
  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'resend_key').maybeSingle()
    return (data?.value as string) || null
  } catch (_) { return null }
}

async function sendViaResend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; html: string; text?: string; reply_to?: string; headers?: Record<string, string> }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, error: data?.message || `HTTP ${r.status}` }
    return { ok: true, id: data?.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ── Templates ──────────────────────────────────────────────────────────────

function confirmEmailHtml(opts: { confirmUrl: string; unsubUrl: string; name?: string | null }) {
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : 'Hi there,'
  return `<!doctype html><html><body style="margin:0;background:#f3f7fc;font-family:'Source Sans 3',system-ui,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;margin-top:24px;box-shadow:0 8px 24px rgba(15,23,42,.08)">
    <div style="background:linear-gradient(135deg,#0b1f3f,#1e3a8a);color:#fff;padding:28px 28px 22px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(167,139,250,.85);margin-bottom:6px">KoreHani</div>
      <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;line-height:1.2">Confirm your subscription</div>
    </div>
    <div style="padding:24px 28px 8px">
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">${greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Tap the button below to start receiving weekly Korean learning tips and new content updates from KoreHani.</p>
      <p style="margin:0 0 24px"><a href="${opts.confirmUrl}" style="display:inline-block;padding:12px 26px;background:#2563eb;color:#fff;text-decoration:none;border-radius:999px;font-weight:800;font-size:14px">Confirm subscription</a></p>
      <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0 0 6px">If you didn't sign up, you can safely ignore this email.</p>
      <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0 0 6px">Or paste this link into your browser:</p>
      <p style="font-size:12px;color:#475569;word-break:break-all;margin:0 0 18px">${opts.confirmUrl}</p>
    </div>
    <div style="padding:14px 28px 22px;border-top:1px solid #eef2f7;font-size:11px;color:#94a3b8;line-height:1.6">
      You're receiving this because someone (hopefully you) entered ${'this email'} on korehani.com.
      <br><a href="${opts.unsubUrl}" style="color:#94a3b8">Unsubscribe</a>
    </div>
  </div>
</body></html>`
}

function escapeHtml(s: string) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function withUnsubFooter(html: string, unsubUrl: string) {
  // Append a one-click unsubscribe footer if the campaign body doesn't
  // already have one. Required for List-Unsubscribe deliverability.
  if (html.includes('{{unsubscribe_url}}')) {
    return html.replaceAll('{{unsubscribe_url}}', unsubUrl)
  }
  return html + `<hr style="border:0;border-top:1px solid #e5e7eb;margin:30px 0 12px"><p style="font-size:11px;color:#94a3b8;text-align:center">You're receiving this email because you subscribed to KoreHani updates. <a href="${unsubUrl}" style="color:#94a3b8">Unsubscribe</a>.</p>`
}

// ── Handlers ────────────────────────────────────────────────────────────────

// In-process per-email cooldown to stop one address being used to
// shotgun confirmation emails (was the obvious vector after we made
// the subscribe RPC public). Lives in module scope so it survives
// across requests within the same Deno isolate. Hard-cleared by
// isolate restart, which is fine — a real abuser would need to wait
// out our 1-min window across hundreds of cold-start instances.
const SUBSCRIBE_COOLDOWN_MS = 60_000
const lastSubscribeAt = new Map<string, number>()
function _gcSubscribeMap() {
  const cutoff = Date.now() - SUBSCRIBE_COOLDOWN_MS * 4
  for (const [email, t] of lastSubscribeAt) if (t < cutoff) lastSubscribeAt.delete(email)
}

async function handleSubscribe(
  sb: ReturnType<typeof createClient>,
  body: { email?: string; name?: string; source?: string },
  cors: Record<string, string>,
) {
  const email = String(body.email || '').toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400, cors)
  }
  // Per-email cooldown: 1 minute between confirm-email triggers. Keeps
  // a single subscriber from being signed up 1000× by a bot in a few
  // seconds, which would burn the Resend quota and look like spam to
  // the recipient.
  const now = Date.now()
  const last = lastSubscribeAt.get(email) || 0
  if (now - last < SUBSCRIBE_COOLDOWN_MS) {
    return jsonResponse({ ok: true, status: 'cooldown' }, 200, cors)
  }
  lastSubscribeAt.set(email, now)
  if (lastSubscribeAt.size > 1000) _gcSubscribeMap()

  const { data: rpcRes, error: rpcErr } = await sb.rpc('newsletter_request_subscribe', {
    p_email: email,
    p_name: body.name || null,
    p_source: body.source || 'footer',
  })
  if (rpcErr) {
    console.error('[newsletter-send] rpc failed:', rpcErr.message)
    return jsonResponse({ ok: false, error: 'subscribe_failed' }, 500, cors)
  }

  const status: string = (rpcRes && (rpcRes as Record<string, unknown>).status as string) || ''
  // Already-confirmed users don't need another confirmation email.
  if (status === 'already_confirmed') {
    return jsonResponse({ ok: true, status: 'already_confirmed' }, 200, cors)
  }

  const confirmToken: string | undefined = rpcRes && (rpcRes as Record<string, unknown>).confirm_token as string
  if (!confirmToken) {
    return jsonResponse({ ok: true, status }, 200, cors)
  }

  // Pull the unsubscribe token from the row so we can put both links
  // in the email. RPC didn't return it (it doesn't change per request)
  // — service-role select is fine here.
  const { data: row } = await sb.from('newsletter_subs')
    .select('unsubscribe_token, name')
    .eq('email', email)
    .maybeSingle()

  const apiKey = await getResendKey(sb)
  if (!apiKey) {
    // Schema-only deployment (admin hasn't added the key yet). Still
    // succeed at the public layer — the confirm link won't actually
    // reach the inbox until the key is set, which is fine for a soft
    // launch.
    console.warn('[newsletter-send] no Resend key — confirm email skipped')
    return jsonResponse({ ok: true, status, mailed: false }, 200, cors)
  }

  const confirmUrl = `${SITE_BASE}/confirm-subscription.html?t=${encodeURIComponent(confirmToken)}`
  const unsubUrl   = row?.unsubscribe_token
    ? `${SITE_BASE}/unsubscribe.html?t=${encodeURIComponent(row.unsubscribe_token as string)}`
    : `${SITE_BASE}/unsubscribe.html`
  const html = confirmEmailHtml({ confirmUrl, unsubUrl, name: (row?.name as string | null) || null })

  // List-Unsubscribe header points at the Edge Function so RFC 8058
  // POST works for confirm emails too (mail clients may unsubscribe
  // before the user even confirms — fine, it's a clear "no thanks").
  const headerUnsubUrl = row?.unsubscribe_token
    ? `${UNSUB_ENDPOINT}?t=${encodeURIComponent(row.unsubscribe_token as string)}`
    : UNSUB_ENDPOINT
  const send = await sendViaResend(apiKey, {
    from: DEFAULT_FROM,
    to: email,
    subject: 'Confirm your KoreHani subscription',
    html,
    text: `Confirm your KoreHani subscription:\n${confirmUrl}\n\nDidn't sign up? You can ignore this email.\n\nUnsubscribe: ${unsubUrl}`,
    headers: {
      'List-Unsubscribe': `<${headerUnsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (!send.ok) {
    console.error('[newsletter-send] resend failed:', send.error)
    return jsonResponse({ ok: true, status, mailed: false, error: send.error }, 200, cors)
  }
  return jsonResponse({ ok: true, status, mailed: true, message_id: send.id }, 200, cors)
}

async function handleSendCampaign(
  sb: ReturnType<typeof createClient>,
  userEmail: string,
  body: { campaign_id?: string; test_to?: string },
  cors: Record<string, string>,
) {
  if (!ADMIN_EMAILS.includes(userEmail)) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403, cors)
  }
  const campaignId = String(body.campaign_id || '')
  if (!campaignId) return jsonResponse({ ok: false, error: 'missing_campaign_id' }, 400, cors)

  const { data: campaign, error: cErr } = await sb.from('newsletter_campaigns')
    .select('*').eq('id', campaignId).maybeSingle()
  if (cErr || !campaign) return jsonResponse({ ok: false, error: 'campaign_not_found' }, 404, cors)
  if (campaign.status === 'sent') {
    return jsonResponse({ ok: false, error: 'already_sent' }, 409, cors)
  }

  const apiKey = await getResendKey(sb)
  if (!apiKey) return jsonResponse({ ok: false, error: 'no_api_key' }, 500, cors)

  // Test send: one-shot to the supplied address, do not log to
  // newsletter_sends and don't flip campaign status. Lets the admin
  // proof the email before broadcasting.
  //
  // Token is namespaced (`test-<campaignId>`) so the newsletter_unsubscribe
  // RPC can recognise + reject it (audit P1 #5). The plain literal
  // 'test' the previous code used could collide with a real token row
  // if anyone ever inserted one for QA.
  if (body.test_to) {
    const testToken = `test-${campaignId}`
    const html = withUnsubFooter(campaign.body_html, `${SITE_BASE}/unsubscribe.html?t=${testToken}`)
    const send = await sendViaResend(apiKey, {
      from: `${campaign.from_name} <${campaign.from_email}>`,
      to: body.test_to,
      subject: `[TEST] ${campaign.subject}`,
      html,
      text: campaign.body_text || undefined,
    })
    return jsonResponse({ ok: send.ok, error: send.error, message_id: send.id }, send.ok ? 200 : 502, cors)
  }

  // Atomic transition draft|failed → sending. Two admin tabs hitting
  // "전체 발송" simultaneously would otherwise both pass the read-side
  // 'sent' check and both run the full send loop (audit P1 #16). The
  // .eq('status', ...) condition + .select() count tells us whether
  // we actually won the transition.
  const { data: lockedRows, error: lockErr } = await sb.from('newsletter_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)
    .in('status', ['draft', 'failed'])
    .select('id')
  if (lockErr) {
    return jsonResponse({ ok: false, error: 'lock_failed: ' + lockErr.message }, 500, cors)
  }
  if (!lockedRows || lockedRows.length === 0) {
    // Another invocation already grabbed the campaign (or it was
    // moved to 'sending' / 'sent' by something else). Bail cleanly
    // so the loser doesn't broadcast the same campaign in parallel.
    return jsonResponse({ ok: false, error: 'campaign_already_in_progress' }, 409, cors)
  }

  // Pull confirmed subscribers + their unsubscribe tokens.
  const { data: subs, error: sErr } = await sb.from('newsletter_subs')
    .select('id, email, unsubscribe_token')
    .eq('status', 'confirmed')
  if (sErr) {
    await sb.from('newsletter_campaigns').update({ status: 'failed' }).eq('id', campaignId)
    return jsonResponse({ ok: false, error: 'subscriber_fetch_failed' }, 500, cors)
  }

  // Pre-load every prior 'sent' send for THIS campaign in one query
  // instead of per-subscriber maybeSingle inside the loop. The old
  // pattern was ~1 round trip per subscriber: 1000 subs ≈ 1000 DB
  // queries + 120ms-per-loop pacing → well past the function's wall
  // budget. Now it's a single SELECT, in-memory Set lookup per row.
  const { data: priorSends } = await sb.from('newsletter_sends')
    .select('sub_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'sent')
  const alreadySent = new Set((priorSends || []).map((r: { sub_id: string }) => r.sub_id))

  let sentCount = 0
  let failCount = 0
  let crashed = false
  // Resend free tier rate limit is ~10/sec. We trickle by inserting
  // a 120ms delay between calls — well under the cap and short enough
  // that 500 subs finish in ~60s, inside the function's wall budget.
  try {
    for (const sub of (subs || [])) {
      const unsubUrl = sub.unsubscribe_token
        ? `${SITE_BASE}/unsubscribe.html?t=${encodeURIComponent(sub.unsubscribe_token as string)}`
        : `${SITE_BASE}/unsubscribe.html`
      const html = withUnsubFooter(campaign.body_html, unsubUrl)

      if (alreadySent.has(sub.id as string)) continue

      // List-Unsubscribe per RFC 8058. URL points at the Edge Function
      // (not the static HTML page) because RFC 8058 requires the URL
      // to accept POST with body `List-Unsubscribe=One-Click`. The EF
      // 302-redirects GETs to the friendly /unsubscribe.html so a
      // browser-clicked link still lands on the visible page.
      const headerToken = sub.unsubscribe_token as string | undefined
      const headerUrl = headerToken
        ? `${UNSUB_ENDPOINT}?t=${encodeURIComponent(headerToken)}`
        : UNSUB_ENDPOINT
      const send = await sendViaResend(apiKey, {
        from: `${campaign.from_name} <${campaign.from_email}>`,
        to: sub.email,
        subject: campaign.subject,
        html,
        text: campaign.body_text || undefined,
        headers: {
          'List-Unsubscribe': `<${headerUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      await sb.from('newsletter_sends').upsert({
        campaign_id: campaignId,
        sub_id: sub.id,
        email: sub.email,
        status: send.ok ? 'sent' : 'failed',
        provider_id: send.id || null,
        error: send.error || null,
        sent_at: send.ok ? new Date().toISOString() : null,
      }, { onConflict: 'campaign_id,sub_id' })

      if (send.ok) {
        sentCount++
        await sb.from('newsletter_subs').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id)
      } else {
        failCount++
      }
      await new Promise((r) => setTimeout(r, 120))
    }
  } catch (loopErr) {
    crashed = true
    console.error('[newsletter-send] loop crashed:', (loopErr as Error).message)
  }

  // Always update final status — even on crash, mark as 'failed' so
  // the admin can see + retry. Without this, a wall-time kill or
  // unhandled throw left status='sending' permanently and the
  // campaign was unrelaunchable (audit P1 #17).
  const finalStatus = crashed ? 'failed' : 'sent'
  await sb.from('newsletter_campaigns').update({
    status: finalStatus,
    sent_at: !crashed ? new Date().toISOString() : null,
    recipient_count: sentCount,
  }).eq('id', campaignId)

  return jsonResponse({
    ok: !crashed, sent: sentCount, failed: failCount,
    ...(crashed ? { error: 'loop_crashed_partial_send' } : {}),
  }, crashed ? 500 : 200, cors)
}

// ── Entry ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey)

    let body: { action?: string; email?: string; name?: string; source?: string; campaign_id?: string; test_to?: string }
    try { body = await req.json() }
    catch { return jsonResponse({ ok: false, error: 'invalid_body' }, 400, cors) }

    if (body.action === 'subscribe') {
      return await handleSubscribe(sb, body, cors)
    }

    if (body.action === 'send_campaign') {
      // Verify caller is signed in + admin.
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ ok: false, error: 'no_auth' }, 401, cors)
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
      const ack = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': authHeader, 'apikey': anonKey },
      })
      if (!ack.ok) return jsonResponse({ ok: false, error: 'unauthorized' }, 401, cors)
      const u = await ack.json()
      const email = (u?.email || '').toLowerCase()
      return await handleSendCampaign(sb, email, body, cors)
    }

    return jsonResponse({ ok: false, error: 'unknown_action' }, 400, cors)
  } catch (e) {
    console.error('[newsletter-send] uncaught:', (e as Error).message)
    return jsonResponse({ ok: false, error: (e as Error).message }, 500, cors)
  }
})
