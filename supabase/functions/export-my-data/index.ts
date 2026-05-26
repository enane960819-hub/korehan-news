// ══════════════════════════════════════════════════════════════════════
// export-my-data — GDPR Article 15 (right of access) + Article 20
// (data portability) + PIPA Article 35 (열람권) handler.
//
// Returns a JSON blob containing every row the user owns across the
// learning-hub tables, plus a manifest of storage objects (voice
// recordings, avatars). The frontend serves this as a downloadable
// .json file — the user can keep it, hand it to another service,
// or compare it against the privacy policy's "data we collect" list.
//
// Symmetric with delete-account/index.ts: same USER_KEYED_TABLES list,
// same USER_STORAGE_BUCKETS pattern — if a table is being deleted on
// erasure, it must be exportable on access. Drift between the two
// lists would mean we're either deleting data we never disclosed
// (compliance gap) or disclosing data we're not actually storing
// (false positive).
//
// Auth: Bearer <user JWT>. Service-role used only for the read
// across tables — never exposes another user's data.
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

// Same list as delete-account/index.ts USER_KEYED_TABLES — keep
// synchronized. Each entry has the table name plus the column we
// filter on (always user_id for these tables).
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

// Tables keyed by email (newsletter_subs in particular).
const EMAIL_KEYED_TABLES: ReadonlyArray<string> = [
  'newsletter_subs',
]

const USER_STORAGE_BUCKETS: ReadonlyArray<{ bucket: string; prefix: string }> = [
  { bucket: 'speaking-recordings', prefix: 'speaking' },
  { bucket: 'avatars',             prefix: '' },
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

    // Verify the JWT via anon key (not service role) so we read the
    // requester's identity, not impersonate.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const userData = await userRes.json()
    const userId = userData?.id as string | undefined
    const userEmail = (userData?.email as string | undefined) || null
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401, cors)

    const sb = createClient(supabaseUrl, serviceKey)

    // Build the export payload. Each table block carries its row
    // count + the actual rows; tables that error (missing on this
    // project, RLS-blocked, etc.) get { error: '...' } so the user
    // sees what was attempted.
    type TableExport = { rows?: unknown[]; count?: number; error?: string }
    const tables: Record<string, TableExport> = {}

    for (const table of USER_KEYED_TABLES) {
      try {
        const { data, error } = await sb.from(table).select('*').eq('user_id', userId)
        tables[table] = error
          ? { error: error.message }
          : { rows: data || [], count: (data || []).length }
      } catch (e) {
        tables[table] = { error: (e as Error).message }
      }
    }

    if (userEmail) {
      for (const table of EMAIL_KEYED_TABLES) {
        try {
          const { data, error } = await sb.from(table).select('*').eq('email', userEmail)
          tables[table] = error
            ? { error: error.message }
            : { rows: data || [], count: (data || []).length }
        } catch (e) {
          tables[table] = { error: (e as Error).message }
        }
      }
    }

    // Storage manifests — list the files but don't include their
    // bytes (could be megabytes of audio). The user can request
    // individual files via the regular Supabase Storage signed-URL
    // path if they want raw audio.
    type StorageManifest = { bucket: string; files: Array<{ name: string; size?: number; updated_at?: string }>; error?: string }
    const storage: StorageManifest[] = []
    for (const { bucket, prefix } of USER_STORAGE_BUCKETS) {
      try {
        const dir = prefix ? `${prefix}/${userId}` : userId
        const { data: listing, error: listErr } = await sb.storage.from(bucket).list(dir, { limit: 1000 })
        if (listErr) {
          storage.push({ bucket, files: [], error: listErr.message })
        } else {
          storage.push({
            bucket,
            files: (listing || []).map((f: { name: string; metadata?: { size?: number; updated_at?: string } }) => ({
              name: f.name,
              size: f.metadata?.size,
              updated_at: f.metadata?.updated_at,
            })),
          })
        }
      } catch (e) {
        storage.push({ bucket, files: [], error: (e as Error).message })
      }
    }

    // The auth.users row itself — surface the canonical identity
    // fields. Don't echo the encrypted password hash or the
    // `confirmation_token` etc.
    const authIdentity = {
      id:                   userData?.id || null,
      email:                userEmail,
      email_confirmed_at:   userData?.email_confirmed_at || null,
      created_at:           userData?.created_at || null,
      last_sign_in_at:      userData?.last_sign_in_at || null,
      user_metadata:        userData?.user_metadata || {},
      app_metadata_provider:
        (userData?.app_metadata as Record<string, unknown> | undefined)?.provider || null,
    }

    return jsonResponse({
      ok: true,
      generated_at: new Date().toISOString(),
      user_id: userId,
      auth_identity: authIdentity,
      tables,
      storage,
      // Document the contract so a future maintainer reading an
      // exported file knows what's NOT included (audit logs the
      // operator keeps for security; cached AI artifacts not tied
      // to a single user; etc.).
      notes: [
        'This export covers every table delete-account would remove.',
        'Storage manifests list filenames + sizes only; raw audio/avatar bytes are not embedded — request individual files via Supabase Storage signed URLs.',
        'Server-side audit logs (e.g. Stripe webhook traces, kh_log_error rows older than 90 days) are not personal data and not included.',
      ],
    }, 200, cors)
  } catch (e) {
    console.error('[export-my-data] uncaught:', (e as Error).message)
    return jsonResponse({ error: (e as Error).message }, 500, getCorsHeaders(req))
  }
})
