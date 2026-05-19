import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAILS = ['enane960819@gmail.com']

const ALLOWED_TABLES = new Set([
  'articles','sections','app_settings','user_stats','daily_missions',
  'article_views','character_reporters','user_subscriptions',
  'conversations_data','stories_data','korean_slangs','phone_calls',
  'shop_items','study_daily_content','writing_topics','vocab_overrides',
  'article_cache','comments','newsletter_subs','page_views',
  'saved_words','read_articles','writing_submissions','coin_adjustments',
  'study_picture_prompts','study_room_grammar','study_room_helpers',
  'vocabulary_bank','fast_track_scenarios','user_submissions',
  'room_items','badges','hover_vocab_master','article_study_content',
  'listening_quiz_bank','grammar_examples_cache','grammar_curriculum',
  'newsletter_campaigns','newsletter_sends','study_topic_schedule',
  'profiles','user_blocks',
  // Conversation scenario pool — admin's 🪄 Batch from pool modal
  // queries this table directly via the admin proxy. Without it the
  // select returned "Table not allowed" and the modal hung on
  // "Loading scenarios…" (owner: "ㅡㅡ 무한로딩").
  'conv_scenario_pool',
  // AI usage telemetry — admin-only dashboard reads this to break
  // down Claude spend by user / feature / model. Not user-writable.
  'claude_api_usage',
  // Per-step cache generation log — the AI Cache admin page queries
  // this to surface "which step failed for which article" and offers
  // a retry button.
  'article_cache_generation_log',
  // Signup notification history — admin "Signup Notification Log"
  // page (page-views sibling) reads this for an audit trail.
  'signup_notifications_log',
])

// Whitelist of RPCs the admin client is allowed to call. Without this
// gate the rpc method below would let an admin (or anyone who's
// hijacked the admin token) call ANY SECURITY DEFINER function in the
// database — including ones that mutate other users' data. Add new
// RPCs here as the admin tooling needs them.
const ALLOWED_RPCS = new Set([
  // Admin moderation
  'admin_set_suspension',
  // Newsletter (called from admin newsletter campaign UI)
  'newsletter_request_subscribe','newsletter_confirm','newsletter_unsubscribe',
  // Streak freeze / awards (claimable from user side too, but admin
  // tooling exposes a manual trigger for QA)
  'claim_streak_award','consume_streak_freeze',
  // Study room generators (admin pre-gen tooling)
  'assign_daily_vocab',
  // Conversation scenario pool — admin's "🎲 Pick from pool" + the
  // batch generator hit these. Missing from the allowlist was the
  // reason owner reported "pool 에서 가져오는거 안되는데" — the
  // proxy returned 400 "RPC not allowed: pick_conv_scenario".
  'pick_conv_scenario','mark_conv_scenario_used',
  // Read-only reporting
  'get_blocked_users',
])

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ['https://korehani.com','https://www.korehani.com','https://korehannews.com','https://www.korehannews.com','http://localhost:3000','http://localhost:8888']
  const matched = allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // SUPABASE_ANON_KEY may not be auto-injected in all environments
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs'

    // 1. Verify JWT and admin status
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No authorization header' }, 401, cors)
    }

    const token = authHeader.replace('Bearer ', '')
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey || serviceKey }
    })
    if (!userRes.ok) return json({ error: 'Invalid token' }, 401, cors)

    const user = await userRes.json()
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      return json({ error: 'Not an admin' }, 403, cors)
    }

    // 2. Parse request
    const body = await req.json()
    const { action } = body

    // 3. Execute with service role
    const sb = createClient(supabaseUrl, serviceKey)

    // ── DB Operations ──
    if (action === 'db') {
      const { table, method, params } = body
      if (!table || !ALLOWED_TABLES.has(table)) {
        return json({ error: 'Table not allowed: ' + table }, 400, cors)
      }

      let query = sb.from(table)

      if (method === 'select') {
        // count + head must be passed to the FIRST .select() call.
        // Supabase JS v2 doesn't let you re-apply them via a second
        // .select() — the second call replaces the first and (in
        // some versions) silently drops the options. Building the
        // options object up front keeps {count, head} attached to
        // the only select() invocation.
        const selectOpts: any = {}
        if (params.count) selectOpts.count = 'exact'
        if (params.head) selectOpts.head = true
        query = query.select(params.columns || '*', selectOpts)
        query = applyFilters(query, params)
        const result = await query
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'insert') {
        const result = await query.insert(params.data)
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'update') {
        query = query.update(params.data)
        query = applyFilters(query, params)
        const result = await query
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'upsert') {
        const opts = params.onConflict ? { onConflict: params.onConflict } : undefined
        const result = await query.upsert(params.data, opts)
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'delete') {
        query = query.delete()
        query = applyFilters(query, params)
        const result = await query
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'rpc') {
        const fn = String(params.fn || '')
        if (!ALLOWED_RPCS.has(fn)) {
          return json({ error: 'RPC not allowed: ' + fn }, 400, cors)
        }
        const result = await sb.rpc(fn, params.args || {})
        return json(result, result.error ? 400 : 200, cors)
      }

      return json({ error: 'Unknown method: ' + method }, 400, cors)
    }

    // ── Auth: list users ──
    if (action === 'auth_users') {
      const perPage = body.per_page || 500
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=${perPage}`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      })
      const data = await res.json()
      return json(data, res.ok ? 200 : 400, cors)
    }

    // ── Storage: upload ──
    if (action === 'storage_upload') {
      const { bucket, path: filePath, fileBase64, contentType } = body
      if (!bucket || !filePath || !fileBase64) {
        return json({ error: 'Missing bucket, path, or fileBase64' }, 400, cors)
      }
      const fileBytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0))
      const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true'
        },
        body: fileBytes
      })
      const data = await res.json()
      return json({ ...data, publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}` }, res.ok ? 200 : 400, cors)
    }

    // ── REST passthrough (for complex queries) ──
    if (action === 'rest') {
      const { path: restPath, method: restMethod, restBody } = body
      if (!restPath || !restPath.startsWith('/rest/v1/')) {
        return json({ error: 'Invalid REST path' }, 400, cors)
      }
      // Verify table name from path is allowed
      const tableName = restPath.split('/rest/v1/')[1]?.split('?')[0]
      if (!tableName || !ALLOWED_TABLES.has(tableName)) {
        return json({ error: 'Table not allowed' }, 400, cors)
      }
      const res = await fetch(`${supabaseUrl}${restPath}`, {
        method: restMethod || 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        ...(restBody ? { body: JSON.stringify(restBody) } : {})
      })
      const data = await res.json()
      return json(data, res.ok ? 200 : 400, cors)
    }

    return json({ error: 'Unknown action: ' + action }, 400, cors)

  } catch (e) {
    return json({ error: e.message }, 500, getCorsHeaders(req))
  }
})

function applyFilters(query: any, params: any) {
  if (!params) return query
  if (params.eq) params.eq.forEach((f: any) => { query = query.eq(f.col, f.val) })
  if (params.neq) params.neq.forEach((f: any) => { query = query.neq(f.col, f.val) })
  if (params.gte) params.gte.forEach((f: any) => { query = query.gte(f.col, f.val) })
  if (params.lte) params.lte.forEach((f: any) => { query = query.lte(f.col, f.val) })
  if (params.like) params.like.forEach((f: any) => { query = query.like(f.col, f.val) })
  if (params.ilike) params.ilike.forEach((f: any) => { query = query.ilike(f.col, f.val) })
  if (params.is) params.is.forEach((f: any) => { query = query.is(f.col, f.val) })
  if (params.not) params.not.forEach((f: any) => { query = query.not(f.col, f.op || 'is', f.val) })
  if (params.in) params.in.forEach((f: any) => { query = query.in(f.col, f.val) })
  if (params.order) params.order.forEach((o: any) => { query = query.order(o.col, { ascending: o.asc !== false }) })
  if (params.limit) query = query.limit(params.limit)
  if (params.range) query = query.range(params.range.from, params.range.to)
  if (params.maybeSingle) query = query.maybeSingle()
  if (params.single) query = query.single()
  // count + head are NOT applied here — they're set in the FIRST
  // select() call up in the 'select' method handler. Re-applying via
  // a second select() would override the first and drop the
  // user's column list. See comment above the select case.
  return query
}

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}
