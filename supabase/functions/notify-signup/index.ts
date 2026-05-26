// Pings a configured webhook (Discord / Slack / generic) when a new
// user signs up. Frontend POSTs only the user_id; this function looks
// the user up server-side using the service role so the payload can't
// be forged by anyone hitting the endpoint with a fake email.
//
// Setup (admin runs once):
//   INSERT INTO app_settings (key, value)
//   VALUES ('signup_notify_webhook', 'https://discord.com/api/webhooks/...')
//   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
//
// Discord and Slack accept the same `{content: "..."}` shape — Discord
// renders it as a plain message, Slack renders it via incoming-webhook.
// For richer formatting drop in a Discord embed or Slack blocks payload.

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
  }
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

// Sanitize a user-supplied value before interpolating into the
// Discord / Slack webhook message. user_metadata.full_name is set by
// the user at signup (Google OAuth display name or signUp.options.data)
// so a malicious name can:
//   1. Inject \n@everyone @here — Discord pings every member.
//   2. Inject ``` to break out of code-block formatting and forge UI.
//   3. Embed long markdown links that look like our own URLs.
// Strip newlines, backticks, @/# mention triggers, and length-cap.
function safeWebhookText(s: string): string {
  return String(s || '').replace(/[`\n\r@#]/g, ' ').slice(0, 120).trim()
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Reject signups older than this — anything older is either a returning
// user whose SIGNED_IN event fired on a fresh page load, or a spam
// attempt with a recycled user_id.
const SIGNUP_FRESHNESS_MS = 5 * 60 * 1000

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, supabaseServiceKey)

    let body: { user_id?: string }
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    const userId = (body.user_id || '').trim()
    if (!userId) return jsonResponse({ error: 'Missing user_id' }, 400, cors)

    // Server-side lookup — anything in the payload other than user_id
    // is ignored. Stops a spam client from spoofing email/name.
    const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(userId)
    if (userErr || !userRes?.user) {
      return jsonResponse({ error: 'User not found' }, 404, cors)
    }
    const u = userRes.user
    const createdAtMs = u.created_at ? new Date(u.created_at).getTime() : 0
    if (!createdAtMs || Date.now() - createdAtMs > SIGNUP_FRESHNESS_MS) {
      // Returning user — silently no-op so the frontend doesn't have to
      // know whether a SIGNED_IN event was a real signup or just a
      // session restore.
      return jsonResponse({ ok: true, skipped: 'not_a_new_signup' }, 200, cors)
    }

    // Per-user dedupe — one notification per signup, even if the
    // browser fires our hook twice (e.g. signUp + onAuthStateChange).
    const { data: existing } = await sb
      .from('signup_notifications_log')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) {
      return jsonResponse({ ok: true, skipped: 'already_notified' }, 200, cors)
    }

    // Webhook URL is the only required setting — if it's not set we
    // still log the signup for the admin's history view, but don't
    // try to push anywhere.
    const { data: setting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'signup_notify_webhook')
      .maybeSingle()
    const webhookUrl = (setting?.value || '').trim()

    const meta = (u.user_metadata || {}) as Record<string, unknown>
    const rawName = String(meta.full_name || meta.name || '').trim()
    const provider = String((u.app_metadata as Record<string, unknown> | undefined)?.provider || 'email')
    const emailConfirmed = !!u.email_confirmed_at

    // u.email and provider come from the auth server side (not the
    // request body) so they're trusted, but we still strip backticks /
    // newlines defensively in case a malformed value slips through.
    const safeEmail = safeWebhookText(u.email || '(none)')
    const safeName = safeWebhookText(rawName)
    const safeProvider = safeWebhookText(provider)
    const safeId = safeWebhookText(u.id)
    const safeCreated = safeWebhookText(u.created_at || '')

    // PRIV-F4: the Discord webhook is a US-hosted third party.
    // Sending raw email+name there is a cross-border PII transfer
    // never disclosed in the consent flow (PIPA Art 17 + 27).
    // Drop both from the webhook payload. The signup_notifications_log
    // row inserted below still carries email+name for the admin's
    // own dashboard — that's local DB inside the existing Supabase
    // workspace, not a cross-border push.
    const emailHint = safeEmail.replace(/^([^@]).+@(.+)$/, '$1***@$2')
    const lines = [
      `🎉 **New KoreHani signup**`,
      `• Email: \`${emailHint}\``,
      `• Provider: ${safeProvider}${emailConfirmed ? ' (verified)' : ' (pending verification)'}`,
      `• User ID: \`${safeId}\``,
      `• At: ${safeCreated}`,
    ].filter(Boolean)
    const messageContent = lines.join('\n')
    const name = rawName // kept for the log insert below — DB column is plain text

    let webhookOk = false
    let webhookStatus: number | null = null
    if (webhookUrl) {
      try {
        const wh = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // `content` works for both Discord and Slack incoming webhooks.
          // Slack falls back to top-level `text` if `content` is missing,
          // so we send both — whichever the receiver expects renders.
          body: JSON.stringify({ content: messageContent, text: messageContent }),
        })
        webhookOk = wh.ok
        webhookStatus = wh.status
        if (!wh.ok) {
          const errBody = await wh.text().catch(() => '')
          console.warn('[notify-signup] webhook non-OK:', wh.status, errBody.slice(0, 200))
        }
      } catch (e) {
        console.warn('[notify-signup] webhook fetch failed:', (e as Error).message)
      }
    }

    // Log so the admin can see signup history even when the webhook
    // fails or isn't configured. This also drives the dedupe check
    // above, so the insert MUST complete before this request returns
    // — otherwise a fast retry can race the dedupe SELECT and send
    // two webhooks for the same signup. Codex P2.
    {
      const { error } = await sb.from('signup_notifications_log').insert({
        user_id: u.id,
        email: u.email || null,
        name: name || null,
        provider,
        email_confirmed: emailConfirmed,
        webhook_url_set: !!webhookUrl,
        webhook_ok: webhookOk,
        webhook_status: webhookStatus,
      })
      if (error) console.warn('[notify-signup] log insert failed:', error.message)
    }

    return jsonResponse(
      { ok: true, webhook_set: !!webhookUrl, webhook_ok: webhookOk, status: webhookStatus },
      200,
      cors,
    )
  } catch (e) {
    console.error('[notify-signup] uncaught:', (e as Error).message)
    return jsonResponse({ error: (e as Error).message }, 500, cors)
  }
})
