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
  // Client error log — admin "Client Errors" aux page reads + deletes
  // >7d rows. Without this entry the delete had to route through the
  // user-JWT supabase client, which depended entirely on RLS for
  // safety.
  'client_errors',
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
  const matched = allowed.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // ── DEBUG: temporary diagnostic logger ─────────────────────────
  // Writes one short row to client_errors per invocation so we can
  // see, from outside the function, exactly what state every call
  // reached. Owner reports admin CMS shows 0 counts and we can't get
  // function_edge_logs via the management API SQL endpoint. Remove
  // this block in a follow-up PR once we know the root cause.
  const debugRows: Array<{ stage: string; detail: unknown }> = []
  const debug = (stage: string, detail: unknown) => debugRows.push({ stage, detail })
  const flushDebug = async (sbForDebug: ReturnType<typeof createClient> | null) => {
    if (!sbForDebug || !debugRows.length) return
    try {
      await sbForDebug.from('client_errors').insert({
        message: 'admin-api debug ' + debugRows[debugRows.length - 1].stage,
        context: { source: 'admin-api-debug', steps: debugRows } as Record<string, unknown>,
        severity: 'warn',
        user_agent: req.headers.get('user-agent') || 'unknown',
      })
    } catch (_) {}
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!anonKey) {
      return json({ error: 'Server misconfigured: SUPABASE_ANON_KEY missing' }, 500, cors)
    }

    debug('entry', {
      method: req.method,
      origin: req.headers.get('Origin') || null,
      hasAuth: !!req.headers.get('Authorization'),
      hasApikey: !!req.headers.get('apikey'),
    })

    // 1. Verify JWT and admin status
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      const debugSb = createClient(supabaseUrl, serviceKey)
      await flushDebug(debugSb)
      return json({ error: 'No authorization header' }, 401, cors)
    }

    const token = authHeader.replace('Bearer ', '')
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey }
    })
    debug('auth_user_fetch', { status: userRes.status, ok: userRes.ok })
    if (!userRes.ok) {
      const debugSb = createClient(supabaseUrl, serviceKey)
      await flushDebug(debugSb)
      return json({ error: 'Invalid token' }, 401, cors)
    }

    const user = await userRes.json()
    debug('user_check', {
      hasEmail: !!user?.email,
      emailDomain: user?.email ? String(user.email).split('@')[1] : null,
      isAdmin: !!(user?.email && ADMIN_EMAILS.includes(user.email)),
    })
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      const debugSb = createClient(supabaseUrl, serviceKey)
      await flushDebug(debugSb)
      return json({ error: 'Not an admin' }, 403, cors)
    }

    // 2. Parse request
    const body = await req.json()
    const { action } = body

    // 3. Execute with service role
    const sb = createClient(supabaseUrl, serviceKey)
    debug('parsed_body', { action, table: body.table, method: body.method, hasParams: !!body.params })

    // ── DB Operations ──
    if (action === 'db') {
      const { table, method, params } = body
      // RPC calls use the sentinel `table: '_rpc'` (the client proxy
      // has no real table for an rpc) and are gated separately by the
      // ALLOWED_RPCS check inside the rpc branch below. Skip the
      // ALLOWED_TABLES gate for those so we don't 400 with
      // "Table not allowed: _rpc" before ever reaching the rpc branch.
      // This was the cause of "Pool error: Admin API 400:
      // Table not allowed: _rpc" on the 🎲 Pick from pool button.
      if (method !== 'rpc') {
        if (!table || !ALLOWED_TABLES.has(table)) {
          return json({ error: 'Table not allowed: ' + table }, 400, cors)
        }
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
        debug('select_result', {
          table,
          dataLen: Array.isArray(result.data) ? result.data.length : null,
          hasError: !!result.error,
          errorMsg: result.error ? String((result.error as { message?: unknown }).message || result.error) : null,
          status: result.status,
        })
        await flushDebug(sb)
        return json(result, result.error ? 400 : 200, cors)
      }

      // `params.returning` (set by the client proxy when the caller
      // chained `.select(cols)` after a mutation) tells us to ask the
      // mutation for the affected rows. Without this, supabase-js
      // returns null `data` and the caller's `.select('id')` is silently
      // dropped — exactly the bug behind "batch from pool 1개 생성
      // 하는데 문장분석 1/74". `.single()` / `.maybeSingle()` modifiers
      // are likewise honoured so calls like
      //   `.upsert(rec).select('*').maybeSingle()` (newsletter campaigns)
      // return one row instead of an array.
      const applyReturning = (q: any) => {
        if (params.returning) q = q.select(params.returning)
        if (params.single) q = q.single()
        else if (params.maybeSingle) q = q.maybeSingle()
        return q
      }

      if (method === 'insert') {
        let q: any = query.insert(params.data)
        q = applyReturning(q)
        const result = await q
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'update') {
        if (!hasMutationFilter(params)) {
          return json({ error: 'update requires at least one filter (eq/in/etc.)' }, 400, cors)
        }
        let q: any = query.update(params.data)
        q = applyFilters(q, params)
        q = applyReturning(q)
        const result = await q
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'upsert') {
        const opts = params.onConflict ? { onConflict: params.onConflict } : undefined
        let q: any = query.upsert(params.data, opts)
        q = applyReturning(q)
        const result = await q
        return json(result, result.error ? 400 : 200, cors)
      }

      if (method === 'delete') {
        if (!hasMutationFilter(params)) {
          return json({ error: 'delete requires at least one filter (eq/in/etc.)' }, 400, cors)
        }
        let q: any = query.delete()
        q = applyFilters(q, params)
        q = applyReturning(q)
        const result = await q
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
      // Strict table-name extraction. The previous split-on-? was
      // bypassable: a path like /rest/v1/articles/../auth/v1/admin/users
      // produces tableName='articles/../auth/v1/admin/users' which
      // ALLOWED_TABLES rejects, but the FETCH still hits the literal
      // path which Supabase normalizes. Lock the extraction to a
      // bare identifier-shaped table segment before any /, ?, or end.
      const m = restPath.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)(?:\?|$)/)
      const tableName = m && m[1]
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

// A buggy admin client sending update/delete with no filter would
// otherwise execute against EVERY row of the target table. PostgREST
// itself blocks bare DELETE without WHERE, but supabase-js with
// service role bypasses that — this is the last line of defence.
function hasMutationFilter(params: any): boolean {
  if (!params) return false
  const filterKeys = ['eq','neq','gte','gt','lte','lt','like','ilike','is','not','in']
  for (const k of filterKeys) {
    if (Array.isArray(params[k]) && params[k].length) return true
  }
  return false
}

function applyFilters(query: any, params: any) {
  if (!params) return query
  if (params.eq) params.eq.forEach((f: any) => { query = query.eq(f.col, f.val) })
  if (params.neq) params.neq.forEach((f: any) => { query = query.neq(f.col, f.val) })
  if (params.gte) params.gte.forEach((f: any) => { query = query.gte(f.col, f.val) })
  if (params.gt)  params.gt.forEach((f: any)  => { query = query.gt(f.col, f.val) })
  if (params.lte) params.lte.forEach((f: any) => { query = query.lte(f.col, f.val) })
  if (params.lt)  params.lt.forEach((f: any)  => { query = query.lt(f.col, f.val) })
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
