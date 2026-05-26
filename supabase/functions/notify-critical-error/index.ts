// Pings a configured webhook (Discord / Slack / generic) when a
// critical-severity row lands in client_errors. AN-F2 from the 7th
// audit — payment webhook signature failures, "speaking_coin_unredeemed"
// (charged but undelivered), refund-shortfall events, OAuth bypasses
// etc. now reach the operator in real time instead of waiting until
// the admin opens the Errors dashboard.
//
// Trust model: the only thing the caller is allowed to supply is
// `{ id: number }`. The function fetches the row server-side with
// the service role, refuses to notify on anything that isn't
// severity='critical', and uses a single UPDATE-RETURNING to claim
// the row exactly once (so concurrent retries can't double-notify).
//
// Setup (admin runs once):
//   INSERT INTO app_settings (key, value)
//   VALUES ('error_notify_webhook', 'https://discord.com/api/webhooks/...')
//   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
//
// Same Discord/Slack-compatible `{content, text}` shape as
// notify-signup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS — the frontend calls this from korehani.com domains; the
// webhook also calls it server-side (no Origin header) which the
// permissive null-Origin branch tolerates.
const ALLOWED_ORIGINS = [
  'https://korehani.com',
  'https://www.korehani.com',
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null;
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (matched) h['Access-Control-Allow-Origin'] = matched;
  return h;
}

// Sanitize anything we interpolate into the webhook body. The
// stack/context/message fields originate in user-facing pages so
// nothing here is trusted — strip newlines (Discord uses \n as
// formatting), backticks (code-fence break), @/# (mention triggers
// like @everyone / @here / channel pings), and length-cap.
function safeWebhookText(s: unknown, max = 400): string {
  return String(s ?? '').replace(/[`\n\r@#]/g, ' ').slice(0, max).trim();
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405, cors);

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let body: { id?: number | string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid JSON body' }, 400, cors);
    }
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ error: 'missing/invalid id' }, 400, cors);
    }

    // Atomic claim — if another concurrent call already notified
    // for this row (notified_at IS NOT NULL) OR if the row isn't
    // actually critical-severity, this UPDATE returns zero rows
    // and we skip the webhook send. Defense-in-depth against a
    // forged caller passing the id of a low-severity row to spam
    // the operator.
    const { data: claimed, error: claimErr } = await sb
      .from('client_errors')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id)
      .eq('severity', 'critical')
      .is('notified_at', null)
      .select('id, message, stack, url, user_agent, context, severity, created_at, user_id')
      .maybeSingle();

    if (claimErr) {
      console.error('[notify-critical-error] claim update failed', claimErr);
      return jsonResponse({ error: 'claim failed: ' + claimErr.message }, 500, cors);
    }
    if (!claimed) {
      // Either: id doesn't exist, severity != 'critical', or already
      // notified. All three are "do nothing" success cases.
      return jsonResponse({ ok: true, skipped: 'not_critical_or_already_notified' }, 200, cors);
    }

    // Pull the webhook URL. If it's not configured the row is still
    // marked notified_at (above) — that's intentional: when the owner
    // later configures the webhook, we don't want a backlog of old
    // critical events flooding the channel.
    const { data: setting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'error_notify_webhook')
      .maybeSingle();
    const webhookUrl = (setting?.value || '').trim();
    if (!webhookUrl) {
      return jsonResponse({ ok: true, claimed: true, skipped: 'webhook_not_configured' }, 200, cors);
    }

    // Build the message. Discord renders code blocks for the stack;
    // keep it short — 1900 chars is the safety margin under Discord's
    // 2000-char content limit.
    const safeMsg     = safeWebhookText(claimed.message, 300);
    const safeUrl     = safeWebhookText(claimed.url, 200);
    const safeUA      = safeWebhookText(claimed.user_agent, 120);
    const safeUserId  = safeWebhookText(claimed.user_id || '(anon)', 64);
    const safeStack   = safeWebhookText(claimed.stack, 800);
    const contextStr  = claimed.context
      ? safeWebhookText(JSON.stringify(claimed.context), 500)
      : '';

    const lines = [
      `🚨 **KoreHani — critical client_error**`,
      `• Message: ${safeMsg}`,
      `• URL: ${safeUrl}`,
      `• User: \`${safeUserId}\``,
      contextStr ? `• Context: \`${contextStr}\`` : '',
      safeUA ? `• UA: ${safeUA}` : '',
      safeStack ? `• Stack: \`\`\`${safeStack}\`\`\`` : '',
      `• Row id: ${claimed.id}  •  At: ${claimed.created_at}`,
    ].filter(Boolean);
    const messageContent = lines.join('\n').slice(0, 1900);

    let webhookOk = false;
    let webhookStatus: number | null = null;
    try {
      const wh = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent, text: messageContent }),
      });
      webhookOk = wh.ok;
      webhookStatus = wh.status;
      if (!wh.ok) {
        const errBody = await wh.text().catch(() => '');
        console.warn('[notify-critical-error] webhook non-OK:', wh.status, errBody.slice(0, 200));
      }
    } catch (e) {
      console.warn('[notify-critical-error] webhook fetch failed:', (e as Error).message);
    }

    return jsonResponse(
      { ok: true, claimed: true, webhook_ok: webhookOk, webhook_status: webhookStatus },
      200,
      cors,
    );
  } catch (e) {
    console.error('[notify-critical-error] uncaught:', (e as Error).message);
    return jsonResponse({ error: (e as Error).message }, 500, cors);
  }
});
