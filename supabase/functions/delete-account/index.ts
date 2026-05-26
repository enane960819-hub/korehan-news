// ══════════════════════════════════════════════════════════════════════
// delete-account — GDPR Article 17 right-to-erasure handler.
//
// Verifies the JWT, then uses service-role to cascade-delete every
// row keyed off the user's auth.users.id, and finally calls
// auth.admin.deleteUser() to remove the auth row itself.
//
// Frontend calls this from My Page → Delete account. The frontend
// pre-deletes a few tables for snappy UX, but this function is the
// authoritative cleanup — it must idempotently handle "already
// partially deleted" state.
//
// Auth: Bearer <user JWT>. The function will only delete the rows
// belonging to that user — nobody can ask to delete someone else's
// account.
// ══════════════════════════════════════════════════════════════════════

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
    'Vary': 'Origin',
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

// Tables that hold per-user rows keyed by user_id. Order chosen so
// child tables go before any parent the user_id FKs reference. All
// deletes are idempotent (delete N matching rows or 0).
//
// If a table doesn't exist on this project the delete returns an
// error which we collect and log but don't fail-fast on — partial
// success is fine for an erasure request; the auth row removal is
// what makes the operation legally meaningful.
//
// PRIV-F2: newsletter_subs is INTENTIONALLY EXCLUDED — that table is
// keyed by email, not user_id, so the .eq('user_id', userId) clause
// silently no-ops. It's handled separately below via email lookup.
const USER_KEYED_TABLES: ReadonlyArray<string> = [
  'saved_words',
  'user_saved_words',
  'user_saved_phrases',
  'user_read_history',
  'user_daily_progress',
  'user_quiz_results',
  'user_stats',
  'user_submissions',
  'user_subscriptions',
  'user_blocks',
  'speaking_coin_wallet',
  'speaking_coin_purchases',
  'xp_log',
  'read_articles',
  'bookmarks',
  'comments',
  'signup_notifications_log',
  'claude_api_usage',
  'user_quota_overrides',
  'notifications',
  'profiles',
  'tutor_students',
]

// PRIV-F1: storage buckets that hold per-user files. The bucket
// loop deletes everything under `<prefix>/<userId>/` so audio /
// avatar binaries are erased alongside row data.
const USER_STORAGE_BUCKETS: ReadonlyArray<{ bucket: string; prefix: string }> = [
  { bucket: 'speaking-recordings', prefix: 'speaking' }, // speaking/<userId>/<file>.webm
  { bucket: 'avatars',             prefix: '' },         // <userId>/avatar.jpg
]

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')
    if (!anonKey) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_ANON_KEY missing' }, 500, cors)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401, cors)

    // Verify the JWT and extract the user_id. Use anon key (not
    // service role) for the verify call so we read the user's own
    // identity, not impersonate.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const userData = await userRes.json()
    const userId = userData?.id as string | undefined
    // PRIV-F2: capture email BEFORE the auth row is deleted so we can
    // purge email-keyed tables (newsletter_subs is the known one).
    const userEmail = (userData?.email as string | undefined) || null
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401, cors)

    // Service-role client for the actual deletion work.
    const sb = createClient(supabaseUrl, serviceKey)

    // 1. Cascade through every user-keyed table. Per-table errors are
    //    collected but don't stop the cleanup — we want as much data
    //    removed as possible even if one table is missing/RLS-blocked.
    const tableResults: Array<{ table: string; ok: boolean; error?: string }> = []
    for (const table of USER_KEYED_TABLES) {
      try {
        const { error } = await sb.from(table).delete().eq('user_id', userId)
        if (error) {
          tableResults.push({ table, ok: false, error: error.message })
        } else {
          tableResults.push({ table, ok: true })
        }
      } catch (e) {
        tableResults.push({ table, ok: false, error: (e as Error).message })
      }
    }

    // 1a. PRIV-F2: newsletter_subs is keyed by email, not user_id.
    // Delete the row by the email captured above. No-op if the user
    // never subscribed or already unsubscribed.
    let newsletterResult: { ok: boolean; deleted_email?: boolean; error?: string } = { ok: true }
    if (userEmail) {
      try {
        const { error: nlErr } = await sb.from('newsletter_subs').delete().eq('email', userEmail)
        newsletterResult = nlErr
          ? { ok: false, error: nlErr.message }
          : { ok: true, deleted_email: true }
      } catch (e) {
        newsletterResult = { ok: false, error: (e as Error).message }
      }
    }

    // 1b. PRIV-F1: storage bucket cleanup. Right-to-erasure must
    // remove voice recordings + avatars in addition to row data.
    // Each bucket holds `<prefix?>/<userId>/<file>` — list then remove.
    const storageResults: Array<{ bucket: string; ok: boolean; deleted: number; error?: string }> = []
    for (const { bucket, prefix } of USER_STORAGE_BUCKETS) {
      try {
        const dir = prefix ? `${prefix}/${userId}` : userId
        const { data: listing, error: listErr } = await sb.storage.from(bucket).list(dir, { limit: 1000 })
        if (listErr) {
          // Bucket might not exist in this project — log and continue.
          storageResults.push({ bucket, ok: false, deleted: 0, error: listErr.message })
          continue
        }
        const paths = (listing || []).map((f) => `${dir}/${f.name}`)
        if (!paths.length) {
          storageResults.push({ bucket, ok: true, deleted: 0 })
          continue
        }
        const { error: rmErr } = await sb.storage.from(bucket).remove(paths)
        if (rmErr) {
          storageResults.push({ bucket, ok: false, deleted: 0, error: rmErr.message })
        } else {
          storageResults.push({ bucket, ok: true, deleted: paths.length })
        }
      } catch (e) {
        storageResults.push({ bucket, ok: false, deleted: 0, error: (e as Error).message })
      }
    }

    // 2. Delete the auth.users row itself. This is the legally
    //    meaningful step — without it the user's email and OAuth
    //    identity remain in the auth schema forever.
    let authDeleteOk = false
    let authDeleteError: string | null = null
    try {
      const { error: authErr } = await sb.auth.admin.deleteUser(userId)
      if (authErr) {
        authDeleteError = authErr.message
      } else {
        authDeleteOk = true
      }
    } catch (e) {
      authDeleteError = (e as Error).message
    }

    if (!authDeleteOk) {
      console.error('[delete-account] auth.admin.deleteUser failed:', authDeleteError)
      // Return 207-ish multi-status as 200 with details. The frontend
      // already partial-deleted the headline tables; we just want the
      // user informed that the auth row remains.
      return jsonResponse({
        ok: false,
        user_id: userId,
        tables: tableResults,
        newsletter: newsletterResult,
        storage: storageResults,
        auth_delete: { ok: false, error: authDeleteError },
        message: 'Data tables cleared, but the auth row could not be removed. Please contact hello@korehani.com so we can finish the deletion.',
      }, 200, cors)
    }

    return jsonResponse({
      ok: true,
      user_id: userId,
      tables: tableResults,
      newsletter: newsletterResult,
      storage: storageResults,
      auth_delete: { ok: true },
    }, 200, cors)
  } catch (e) {
    console.error('[delete-account] uncaught:', (e as Error).message)
    return jsonResponse({ error: (e as Error).message }, 500, getCorsHeaders(req))
  }
})
