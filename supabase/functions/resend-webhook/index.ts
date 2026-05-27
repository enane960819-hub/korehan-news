// ══════════════════════════════════════════════════════════════════════
// resend-webhook — receives Resend bounce / complaint events and
// suppresses the matching subscriber so we don't keep sending to
// dead addresses (which crashes sender reputation).
//
// EMAIL-F3 from the 12th audit. Without this, every hard-bounced or
// spam-complaint inbox stays in the `confirmed` filter and the next
// campaign re-sends to them → ISP feedback loop counts them again
// → within weeks Resend (and Gmail) start junking the entire domain.
//
// Resend uses Svix to sign webhook deliveries. The headers are:
//   svix-id          — unique delivery id (for replay dedup)
//   svix-timestamp   — unix timestamp of the delivery
//   svix-signature   — `v1,<base64-sha256>` HMAC of `id.timestamp.body`
//
// Owner setup:
//   1. Resend dashboard → Webhooks → Add Endpoint:
//      https://<project>.supabase.co/functions/v1/resend-webhook
//   2. Subscribe to:  email.bounced, email.complained,
//      email.delivery_delayed (optional)
//   3. Copy the signing secret (`whsec_...`) and set:
//      `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...`
//   4. Deploy: `supabase functions deploy resend-webhook --no-verify-jwt`
//      (the --no-verify-jwt flag is required because Resend POSTs with
//      its own signature, not a Supabase JWT.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Constant-time string comparison to avoid timing leaks on the
// signature compare. Deno doesn't ship one stdlib; we roll our own.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function verifySignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  // Reject if delivery is older than 5 minutes — replay defense.
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false
  }
  // The secret arrives as `whsec_<base64>`. Strip the prefix.
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const toSign = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`)
  const sigBuf = await crypto.subtle.sign('HMAC', key, toSign)
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
  // signatureHeader is `v1,<sig> v1,<sig> ...` — Svix supports key
  // rotation by sending multiple. Any match is accepted.
  return signatureHeader
    .split(' ')
    .map((s) => s.trim())
    .some((s) => s.startsWith('v1,') && timingSafeEqual(s.slice(3), expected))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set')
    // Return 200 so Resend doesn't keep retrying while we wait for
    // the operator to set the secret. We DO log so the gap is
    // visible in function logs.
    return jsonResponse({ error: 'misconfigured' }, 200)
  }

  const svixId        = req.headers.get('svix-id') || ''
  const svixTimestamp = req.headers.get('svix-timestamp') || ''
  const svixSignature = req.headers.get('svix-signature') || ''
  if (!svixId || !svixTimestamp || !svixSignature) {
    return jsonResponse({ error: 'missing signature headers' }, 400)
  }

  const body = await req.text()
  const ok = await verifySignature(secret, svixId, svixTimestamp, body, svixSignature)
  if (!ok) {
    console.warn('[resend-webhook] signature verification failed', { svixId })
    return jsonResponse({ error: 'invalid signature' }, 400)
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string[]; from?: string; bounce?: { type?: string }; reason?: string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const type = payload.type || ''
  const toList = payload.data?.to || []
  const target = toList[0]?.toLowerCase().trim() || null

  // Always log the raw event for traceability — newsletter_sends
  // already has per-message rows; we mirror into client_errors with
  // severity 'warn' so the admin dashboard surfaces them.
  try {
    await sb.from('client_errors').insert({
      message: `Resend webhook: ${type}`,
      context: {
        source: 'resend-webhook',
        type,
        email: target,
        bounce_type: payload.data?.bounce?.type || null,
        reason: payload.data?.reason || null,
        email_id: payload.data?.email_id || null,
      },
      url: null,
      user_agent: 'resend-webhook',
      severity: type === 'email.complained' ? 'critical' : 'warn',
    })
  } catch (_) { /* swallow */ }

  if (!target) {
    return jsonResponse({ ok: true, ignored: 'no target email' }, 200)
  }

  // Suppress on hard bounce + complaint. Soft bounces (transient
  // mailbox-full / DNS timeout) ARE NOT suppressed — Resend retries
  // them on its own.
  const isHardBounce =
    type === 'email.bounced' && payload.data?.bounce?.type === 'permanent'
  const isComplaint = type === 'email.complained'

  if (isHardBounce || isComplaint) {
    try {
      const { error } = await sb.from('newsletter_subs')
        .update({
          status:         'bounced',
          // newsletter_subs.status enum allows 'bounced' per
          // 20260412_newsletter_subs.sql line 26. Spam complaints
          // are treated as immediate hard suppression — same as
          // a hard bounce for sender-reputation purposes.
          updated_at:     new Date().toISOString(),
        })
        .eq('email', target)
      if (error) {
        console.error('[resend-webhook] suppress update failed', error.message)
      }
    } catch (e) {
      console.error('[resend-webhook] suppress catch', (e as Error).message)
    }
  }

  return jsonResponse({ ok: true, processed: type, target }, 200)
})
