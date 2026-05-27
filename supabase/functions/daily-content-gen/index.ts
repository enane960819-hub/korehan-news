// Daily Content Generator — runs on cron schedule
// Generates study_daily_content for all 4 levels × today + tomorrow
// Triggered by: pg_cron → pg_net HTTP call, or manual invoke
//
// Auth accepts any of:
//   - SUPABASE_SERVICE_ROLE_KEY env var (default Supabase admin)
//   - CRON_SECRET env var (custom secret we set ourselves; preferred
//     for cron because it's stable across service-role rotations)
//   - A signed-in admin user JWT matching ADMIN_EMAIL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALL_LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced'] as const
type Level = typeof ALL_LEVELS[number]

const ADMIN_EMAIL = 'enane960819@gmail.com'

// CRON-F13: writing-topic rotation epoch. Previously hardcoded in
// 2 spots in this file + 5 spots in korehan-x9f4k2m7.html. A
// maintainer who tweaks one (e.g. to skip a corrupted topic batch)
// will silently desync admin "preview today's topic" from cron
// generation. Extracted to one place per file; the admin page has
// its own KH_WRITING_TOPICS_EPOCH near the top — keep them in sync.
const WRITING_TOPICS_EPOCH_ISO = '2026-04-15T00:00:00+09:00'

// KST date helpers
function kstToday(): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number): string {
  // Parse the YYYY-MM-DD as a plain UTC date and add days in UTC.
  // The previous version constructed a KST-anchored Date, added ms,
  // then sliced the resulting toISOString() — which silently dropped
  // the KST offset and made today === tomorrow when KST was already
  // past UTC midnight. Plain UTC arithmetic on the date string avoids
  // the round-trip entirely.
  const d = new Date(dateStr + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function buildPrompt(level: Level, topicHint: string): { staticPrefix: string; dynamicSuffix: string } {
  // CRON-F6: prompt-caching shape. Returns a static prefix (grammar
  // rules + schema — same for every call of a given level) and a
  // dynamic suffix (topic hint — changes per call). The caller
  // assembles them as two content blocks with cache_control on the
  // first, so concurrent retries within the 5-min TTL window hit
  // the cache at ~10% of full input cost.
  //
  // Per shared/prompt-caching.md: cacheable prefix must be ≥1024
  // tokens on Sonnet 4.6. The staticPrefix here is ~1800–2200 tokens
  // depending on level, comfortably above that floor.
  const levelGuide: Record<Level, string> = {
    Starter:      'STARTER (TOPIK 0): Ultra-basic. Daily life, family, food. Vocab: 1-2 syllable words. Grammar: ~이에요/예요, ~있어요/없어요. Sentences max 4 words.',
    Beginner:     'BEGINNER (TOPIK 1-2): Present tense (~아요/어요). Basic particles. Everyday vocab. Helper sentences 5-8 words.',
    Intermediate: 'INTERMEDIATE (TOPIK 3-4): Past tense, conjunctions, modals. Sentences 8-12 words. Topic-specific terms.',
    Advanced:     'ADVANCED (TOPIK 5-6): Complex structures, formal style, advanced connectors. Sentences 12+ words. Abstract vocab.',
  }

  let levelExtra = ''
  let levelExtraCounts = ''

  if (level === 'Beginner') {
    levelExtra = '\nFor each grammar item, also include a "parts" array that breaks example_ko into color-coded parts: [{"text":"word","role":"subject|object|verb|particle|other"}]. Every word in example_ko must appear.'
  }
  if (level === 'Intermediate' || level === 'Advanced') {
    levelExtra += ',"confusing_grammar":[{"pair":["~grammar1","~grammar2"],"explanation":"","wrong":"","correct":""}]'
    levelExtraCounts += ', confusing_grammar=2'
  }
  if (level === 'Advanced') {
    levelExtra += ',"formality_exercise":{"casual":"","formal":"","explanation":""},"culture_note":"1-2 sentence Korean cultural note"'
    levelExtraCounts += ', formality_exercise=1, culture_note=1'
  }

  // Static — same across every call of the same level. Cacheable.
  const staticPrefix = `Korean language teacher. Create daily study content for ${level} level.
Level: ${levelGuide[level]}

KOREAN GRAMMAR RULES — apply to EVERY Korean sentence in vocab examples, grammar examples, helpers, dictation_sentences, and dictation_questions:
1. PSYCH-VERB 1st/3rd PERSON ASYMMETRY (do not violate):
   • Subject is 저/나/우리/I/me/we → use the "feeling" form directly:
     ✓ 저는 가고 싶어요 / 저는 슬퍼요 / 저는 좋아요 / 저는 무서워요
   • Subject is 3rd-person (그/그녀/이름/사람들/아이들/우리 가족/누구/this person):
     MUST use the "-아/어 하다" form, NOT the bare adjective form:
     ✓ 아이들은 만들고 싶어 해요    ✗ 아이들은 만들고 싶어요
     ✓ 우리 가족은 쉬고 싶어 해요    ✗ 우리 가족은 쉬고 싶어요
     ✓ 동생은 슬퍼해요             ✗ 동생은 슬퍼요
     ✓ 그는 무서워해요             ✗ 그는 무서워요
     Same rule applies to: 싶다→싶어 하다, 슬프다→슬퍼하다, 기쁘다→기뻐하다,
     무섭다→무서워하다, 싫다→싫어하다, 부끄럽다→부끄러워하다, 좋다→좋아하다.
2. SUBJECT-PARTICLE CONSISTENCY: a single sentence must not flip 은/는 ↔ 이/가
   mid-clause for the same referent. Pick one and stick with it.
3. FORMALITY CONSISTENCY: one sentence must not mix 합쇼체 (~ㅂ니다) with
   해요체 (~아요/어요) or with 반말 (~아/어). Stay in the level's register.
4. TENSE AGREEMENT: if the topic implies past/future ("어제…", "내일…"), all
   verbs in the same clause must match that tense.

Return ONLY valid JSON (strict RFC8259, no markdown, no comments, no trailing commas):
{"topic_ko":"...","topic_en":"...",
"vocab":[{"ko":"word","rom":"romanization","en":"meaning","level":"${level}"}],
"grammar":[{"level":"${level}","pattern":"~grammar pattern","explanation":"English explanation","example_ko":"Korean example","example_en":"English translation"}],
"helpers":[{"ko":"Full Korean example sentence about the topic","en":"English translation"}],
"dictation_sentences":[{"ko":"","en":""}],
"dictation_questions":[{"question_ko":"","answer_ko":"","hint_en":""}]${levelExtra}}
Exact counts: vocab=5, grammar=3, helpers=4, dictation_sentences=3, dictation_questions=3${levelExtraCounts}.
IMPORTANT: "helpers" are full example SENTENCES (not single words) that a student can reference before writing.`

  // Dynamic — changes per call. Topic hint is what the model uses
  // to generate the specific content. Placed AFTER the cache boundary.
  const dynamicSuffix = topicHint
    ? `\n\n${topicHint}`
    : ''

  return { staticPrefix, dynamicSuffix }
}

async function callAnthropic(
  apiKey: string,
  prompt: { staticPrefix: string; dynamicSuffix: string },
  level: Level,
): Promise<Record<string, unknown>> {
  // Sonnet for the complex schemas (Intermediate / Advanced — these
  // include confusing_grammar / formality_exercise / culture_note and
  // Haiku 4.5 was returning malformed JSON ~50% of the time on them).
  // Haiku for the simpler Starter / Beginner where it's reliable and
  // costs ~4x less.
  // Sonnet ID bumped from the now-deprecated dated form
  // `claude-sonnet-4-20250514` to the current alias `claude-sonnet-4-6`.
  // Same price tier in the proxy pricing table (both entries already
  // there); the dated id would 404 once the model is fully retired.
  const model = (level === 'Intermediate' || level === 'Advanced')
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001'

  // Token budget per level. Korean text tokenizes 2-3x heavier than
  // English so the schema-heavy Advanced output (vocab + grammar +
  // confusing_grammar + formality_exercise + culture_note + dictation
  // arrays) overshoots the original 1500-token ceiling and gets
  // truncated mid-JSON — that was the real cause of the parse errors,
  // not malformed output. Give each tier enough headroom.
  const maxTokens =
    level === 'Advanced'     ? 3000 :
    level === 'Intermediate' ? 2200 :
    1500

  // CRON-F6: prompt-caching via cache_control on the static prefix.
  // The grammar rules + schema (~2k tokens) are identical for every
  // call of the same level, so a retry within the 5-min TTL pays
  // ~10% of full input cost. Concurrent fan-out in the main loop
  // still pays full price on the first wave (they all hit Anthropic
  // before the cache write commits) but admin-side retries and the
  // pregenKeyExpressions follow-up calls within the same window
  // benefit. The cache key is implicitly per-level since the prefix
  // includes the level name + level-specific schema extras.
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.staticPrefix, cache_control: { type: 'ephemeral' } },
            ...(prompt.dynamicSuffix
              ? [{ type: 'text', text: prompt.dynamicSuffix }]
              : []),
          ],
        },
      ],
    }),
  })
  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`)
  const data = await resp.json()
  const raw = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  let clean = raw.replace(/```json|```/g, '').trim()
  const s = clean.indexOf('{')
  const e = clean.lastIndexOf('}')
  if (s < 0 || e <= s) throw new Error('No JSON in response')
  clean = clean.slice(s, e + 1)
  // Haiku occasionally emits malformed JSON for the more complex
  // Intermediate / Advanced prompts — most often trailing commas
  // (`,]` / `,}`) or stray newlines inside string literals. Try the
  // raw parse first; on failure, run a few cheap repairs and retry
  // before giving up so a single bad item doesn't kill the day's
  // generation.
  try { return JSON.parse(clean) } catch (_) { /* fall through */ }
  const repaired = clean
    .replace(/,(\s*[}\]])/g, '$1')           // trailing comma before } or ]
    .replace(/[ -]+/g, ' ')       // control chars inside strings
  try { return JSON.parse(repaired) } catch (err) {
    throw new Error(`JSON parse failed even after repair: ${(err as Error).message}`)
  }
}

// Parse an Anthropic response that's expected to start/end with [ ... ].
// Mirrors the object-parser above but for top-level arrays — used by
// the Key Expressions + situation-quiz pre-gen that returns a JSON
// array of items instead of a wrapping object.
async function callAnthropicArray(apiKey: string, prompt: string, model: string, maxTokens: number): Promise<unknown[]> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`)
  const data = await resp.json()
  const raw = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  let clean = raw.replace(/```json|```/g, '').trim()
  const s = clean.indexOf('[')
  const e = clean.lastIndexOf(']')
  if (s < 0 || e <= s) throw new Error('No JSON array in response')
  clean = clean.slice(s, e + 1)
  try { return JSON.parse(clean) } catch (_) { /* fall through to repair */ }
  const repaired = clean.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(repaired)
}

// Pre-generate Key Expressions + Situation Quiz for a given
// (date, level, topic) and stash both into grammar_examples_cache
// under the keys the frontend's _aiCacheGet looks for. Mirrors the
// frontend cache-key shape exactly:
//   kex::<topicId>_<level>_<date>      → { expressions: [...] }
//   kex_sit::<topicId>_<level>_<date>  → { situations:  [...] }
// where topicId = "<date>_<level>" (matches _todayTopic.id format
// in korehan-study-room.html). Skips work when the keys are
// already populated so daily reruns are cheap.
async function pregenKeyExpressions(
  sb: ReturnType<typeof createClient>,
  apiKey: string,
  date: string,
  level: Level,
  topic: { ko: string; en: string },
): Promise<{ expressions: boolean; situations: boolean }> {
  const topicId = `${date}_${level}`
  const expressionsKey = `kex::${topicId}_${level}_${date}`
  const situationKey   = `kex_sit::${topicId}_${level}_${date}`

  const { data: existing } = await sb
    .from('grammar_examples_cache')
    .select('pattern_name,patterns_json')
    .in('pattern_name', [expressionsKey, situationKey])
  const existingMap: Record<string, string> = {}
  for (const r of existing || []) existingMap[r.pattern_name] = r.patterns_json

  let expressions: unknown[] | null = null
  let expressionsCached = !!existingMap[expressionsKey]
  let situationsCached  = !!existingMap[situationKey]

  // ── 1. Key Expressions ──────────────────────────────────────
  if (!expressionsCached) {
    const expPrompt =
      `You are a Korean language teacher. Generate EXACTLY 6 key Korean EXPRESSIONS ` +
      `(multi-word phrases, collocations, or fixed sentence patterns) that a student would naturally USE ` +
      `when speaking or writing about the topic: "${topic.ko}" (${topic.en}). Level: ${level}.\n\n` +
      `STRICT RULES:\n` +
      `1. Each "ko" MUST be a multi-word phrase of at least 2 words — NOT a single word.\n` +
      `2. DO NOT return single nouns or single verbs alone.\n` +
      `3. Each expression must be directly usable when talking about this specific topic.\n` +
      `4. Mix grammar patterns, collocations, and common phrasal verbs.\n\n` +
      // PR #7AB (AI grammar audit Path 4): example_ko sentences are the\n
      // Korean output users learn from. Same psych-verb / particle /\n
      // formality / tense / spacing rules as Paths 1-3 (#7Q, #7Z, #7AA).\n
      // Slim version since this prompt's output is sentence-scale.\n
      `KOREAN GRAMMAR RULES for example_ko sentences:\n` +
      `1. PSYCH-VERB 1st/3rd:\n` +
      `   1st-person (저/나/우리) → bare feeling form: 저는 슬퍼요 / 저는 가고 싶어요.\n` +
      `   3rd-person (그/그녀/이름/사람들/아이들) → "-아/어 하다" form:\n` +
      `   ✓ 동생은 슬퍼해요 / 아이들은 만들고 싶어 해요\n` +
      `   ✗ 동생은 슬퍼요 / 아이들은 만들고 싶어요\n` +
      `   Applies to: 싶다, 슬프다, 기쁘다, 무섭다, 싫다, 부끄럽다, 좋다.\n` +
      `2. SUBJECT-PARTICLE: no 은/는 ↔ 이/가 flipping for same referent.\n` +
      `3. FORMALITY: match the level's register (Starter/Beginner → 해요체;\n` +
      `   Intermediate/Advanced may use 합쇼체 or 평어체 — pick one PER\n` +
      `   sentence and stay consistent within that sentence).\n` +
      `4. TENSE AGREEMENT within a clause vs the temporal anchor.\n` +
      `5. SPACING: 가고 싶다 ✓ / 가고싶다 ✗; tense endings attach directly\n` +
      `   to the stem (갔다 ✓, 가았다 ✗).\n\n` +
      `Return ONLY a JSON array of 6 items, no markdown:\n` +
      `[{"ko":"multi-word Korean phrase","rom":"romanization","en":"English meaning",` +
      `"example_ko":"natural Korean sentence about the topic using this exact phrase",` +
      `"example_en":"English translation of the example"}]`
    try {
      const arr = await callAnthropicArray(apiKey, expPrompt, 'claude-haiku-4-5-20251001', 1200)
      expressions = (arr || []).filter((x) => {
        const item = x as { ko?: string }
        if (!item || typeof item.ko !== 'string') return false
        const ko = item.ko.trim()
        return ko.indexOf(' ') !== -1 || ko.length >= 4
      })
      if (expressions.length) {
        await sb.from('grammar_examples_cache').upsert({
          pattern_name:  expressionsKey,
          patterns_json: JSON.stringify({ expressions }),
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'pattern_name' })
        expressionsCached = true
      }
    } catch (_) {
      // Best-effort: don't break the daily-content pipeline.
    }
  } else {
    try {
      const parsed = JSON.parse(existingMap[expressionsKey])
      expressions = Array.isArray(parsed?.expressions) ? parsed.expressions : null
    } catch (_) { expressions = null }
  }

  // ── 2. Situation Quiz (depends on expressions) ──────────────
  if (!situationsCached && Array.isArray(expressions) && expressions.length) {
    const expList = expressions
      .map((e, i) => {
        const item = e as { ko?: string; en?: string }
        return `${i + 1}. ${item.ko || ''} — ${item.en || ''}`
      })
      .join('\n')
    const sitPrompt =
      `Given these Korean expressions:\n${expList}\n\n` +
      `Create exactly 3 real-life situational questions. For each, return JSON with: ` +
      `situation (1-2 sentence English description of a real-life moment), ` +
      `correct_index (0-based index from the list above of the best expression), ` +
      `why (brief English reason). Return a JSON array only, no markdown.`
    try {
      const sits = await callAnthropicArray(apiKey, sitPrompt, 'claude-haiku-4-5-20251001', 800)
      if (Array.isArray(sits) && sits.length) {
        await sb.from('grammar_examples_cache').upsert({
          pattern_name:  situationKey,
          patterns_json: JSON.stringify({ situations: sits }),
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'pattern_name' })
        situationsCached = true
      }
    } catch (_) {
      // Best-effort.
    }
  }

  return { expressions: expressionsCached, situations: situationsCached }
}

Deno.serve(async (req) => {
  // Hoisted across the outer try/catch so the catch block can release
  // the lock + persist to client_errors. The lock-leak (DR-19-F8) bug:
  // before, an Anthropic 429/timeout / DB hiccup inside the main work
  // would skip the happy-path lock cleanup at the bottom of try {} and
  // exit the catch without releasing. Next pg_cron pass within 15 min
  // saw "another generation already in progress" and quietly skipped,
  // leaving daily content stale until someone noticed.
  let lockHeld = false
  let sbForCleanup: ReturnType<typeof createClient> | null = null
  const LOCK_KEY = 'daily_content_gen_lock'
  try {
    // ── Auth ───────────────────────────────────────────────────
    // Three ways in (any one passes):
    //   1. service_role bearer (Supabase auto-injected env var)
    //   2. CRON_SECRET bearer (custom env var we control — used by
    //      pg_cron via vault.decrypted_secrets, stable across
    //      service_role rotation)
    //   3. Admin user JWT (manual invocation from the dashboard /
    //      browser session of the founder account)
    const authHeader = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecret = Deno.env.get('CRON_SECRET') || ''

    // Reject weak CRON_SECRET configs. This function makes ~16 Sonnet
    // calls per invocation; with a guessable secret an attacker can
    // burn through Anthropic credit by replaying invocations. 32 chars
    // is the minimum length that resists brute force at typical
    // function rate limits.
    if (cronSecret && cronSecret.length < 32) {
      console.error('[daily-content-gen] CRON_SECRET too short (<32 chars) — ignoring for auth')
    }
    const token = authHeader.replace('Bearer ', '').trim()
    const tokenMatchesService = token && token === serviceKey
    const tokenMatchesCron    = cronSecret && cronSecret.length >= 32 && token === cronSecret

    if (!tokenMatchesService && !tokenMatchesCron) {
      // Fall back to admin user check
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
      const check = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: anonKey },
      })
      if (!check.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
      const user = await check.json()
      if (!user?.email || user.email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 })
      }
    }

    const sb = createClient(supabaseUrl, serviceKey)
    sbForCleanup = sb

    // Lock-via-app_settings — prevents pg_cron and a manual admin
    // "Generate now" click from running concurrently. Without this,
    // both reads see the same empty state, both fire 16 Sonnet calls,
    // and the upsert silently merges so the double-spend is invisible.
    //
    // Mechanism: app_settings.key='daily_content_gen_lock' holds a
    // timestamp string. We refuse to start if the existing lock is
    // less than LOCK_TTL_MS old; otherwise we overwrite it. Postgres
    // advisory locks would be cleaner but they're session-bound and
    // supabase-js RPC opens a fresh session per call, which makes the
    // built-in pg_try_advisory_lock useless from this code path.
    // LOCK_KEY is hoisted to function scope above (so the outer catch
    // can clean up). CRON-F7: TTL was 5 min, which is shorter than the
    // worst-case Anthropic latency × 8 concurrent calls
    // (Promise.allSettled in the main loop). Sonnet calls on Advanced
    // at 3,000 tokens have observed 30–60s tails; a retry from pg_cron
    // after 5 minutes (the typical retry pattern) would see a "stale"
    // lock, overwrite it, and we'd get two concurrent generations both
    // upserting to the same (scheduled_date, level) rows.
    // 15 min covers the worst case while still releasing if the
    // function actually crashed (no `finally` to clean up).
    const LOCK_TTL_MS = 15 * 60 * 1000
    try {
      const { data: lockRow } = await sb
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', LOCK_KEY)
        .maybeSingle()
      const prevMs = lockRow?.value ? new Date(String(lockRow.value)).getTime() : 0
      if (prevMs && Date.now() - prevMs < LOCK_TTL_MS) {
        return new Response(
          JSON.stringify({ ok: false, error: 'another generation already in progress' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const { error: lockSetErr } = await sb.from('app_settings').upsert(
        { key: LOCK_KEY, value: new Date().toISOString() },
        { onConflict: 'key' },
      )
      if (!lockSetErr) lockHeld = true
    } catch (e) {
      console.warn('[daily-content-gen] lock check skipped:', (e as Error).message)
    }

    // Get Anthropic API key
    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) {
      if (lockHeld) await sb.from('app_settings').delete().eq('key', LOCK_KEY).then(() => {}, () => {})
      return new Response(JSON.stringify({ error: 'No Anthropic API key' }), { status: 500 })
    }

    // Determine dates: today + tomorrow (KST)
    const today = kstToday()
    const tomorrow = addDays(today, 1)
    const dates = [today, tomorrow]

    // Build full generation list: today + tomorrow × all levels
    // Always generate — upsert overwrites stale/wrong topics
    const toGenerate: Array<{ date: string; level: Level }> = []
    for (const date of dates) {
      for (const level of ALL_LEVELS) {
        toGenerate.push({ date, level })
      }
    }

    // Check existing content to skip only if topic matches expected rotation
    const { data: existing } = await sb
      .from('study_daily_content')
      .select('scheduled_date,level,vocab,topic_ko')
      .in('scheduled_date', dates)

    const existingMap: Record<string, { hasVocab: boolean; topic_ko: string }> = {}
    for (const r of existing || []) {
      const hasVocab = r.vocab && (Array.isArray(r.vocab) ? r.vocab.length > 0 : typeof r.vocab === 'string' && r.vocab.length > 2)
      existingMap[`${r.scheduled_date}_${r.level}`] = { hasVocab: !!hasVocab, topic_ko: r.topic_ko || '' }
    }

    // Pre-fetch expected topics per level to check correctness
    const expectedTopics: Record<string, string> = {}
    for (const level of ALL_LEVELS) {
      const { data: topics } = await sb
        .from('writing_topics')
        .select('topic_ko')
        .eq('level', level)
        .eq('active', true)
        .order('sort_order')
        .order('created_at')
      const allTopics = topics || []
      for (const date of dates) {
        if (allTopics.length) {
          const epoch = new Date(WRITING_TOPICS_EPOCH_ISO).getTime()
          const now = new Date(date + 'T00:00:00+09:00').getTime()
          const idx = Math.max(0, Math.floor((now - epoch) / 86400_000)) % allTopics.length
          expectedTopics[`${date}_${level}`] = allTopics[idx].topic_ko
        }
      }
    }

    // Filter: skip only if content exists with correct topic AND has vocab
    const missing = toGenerate.filter(item => {
      const key = `${item.date}_${item.level}`
      const ex = existingMap[key]
      const expected = expectedTopics[key]
      if (!ex || !ex.hasVocab) return true // no content or no vocab → generate
      if (expected && ex.topic_ko !== expected) return true // wrong topic → regenerate
      return false // correct topic with vocab → skip
    })

    if (!missing.length) {
      return new Response(JSON.stringify({ ok: true, message: 'All content exists', dates }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ date: string; level: string; status: string }> = []

    // Generate all missing items in parallel. The previous sequential
    // for-loop with 2s gaps blew past Supabase's wall-clock kill timer
    // — 8 items × ~10-30s each + waits = 100s+ which exceeded the
    // function's hard limit, so only 2-3 items would land before the
    // runtime killed it. Anthropic Haiku tolerates this many concurrent
    // calls fine, and the worst-case wall time drops from O(n) to O(1).
    const settled = await Promise.allSettled(missing.map(async (item) => {
      let topicHint = ''
      let forceTopic: { ko: string; en: string } | null = null
      const { data: topics } = await sb
        .from('writing_topics')
        .select('topic_ko,topic_en,category')
        .eq('level', item.level)
        .eq('active', true)
        .order('sort_order')
        .order('created_at')

      const allTopics = topics || []
      if (allTopics.length) {
        const epoch = new Date(WRITING_TOPICS_EPOCH_ISO).getTime()
        const now = new Date(item.date + 'T00:00:00+09:00').getTime()
        const idx = Math.max(0, Math.floor((now - epoch) / 86400_000)) % allTopics.length
        const t = allTopics[idx]
        topicHint = `Use EXACTLY this topic: "${t.topic_ko}" (${t.topic_en}). Category: ${t.category || ''}.`
        forceTopic = { ko: t.topic_ko, en: t.topic_en }
      } else {
        const cats = ['daily life', 'food & cooking', 'K-pop & music', 'travel in Korea', 'Korean seasons', 'school & studying', 'hobbies', 'Korean culture']
        const h = item.date.split('-').reduce((a, b) => a + parseInt(b), 0)
        topicHint = `Pick a specific topic within: "${cats[h % cats.length]}"`
      }

      const prompt = buildPrompt(item.level, topicHint)
      const parsed = await callAnthropic(apiKey, prompt, item.level)

      const rec = {
        scheduled_date: item.date,
        level: item.level,
        topic_ko: forceTopic?.ko || (parsed.topic_ko as string) || '',
        topic_en: forceTopic?.en || (parsed.topic_en as string) || '',
        vocab: parsed.vocab || [],
        grammar: parsed.grammar || [],
        helpers: parsed.helpers || [],
        dictation_sentences: parsed.dictation_sentences || [],
        dictation_questions: parsed.dictation_questions || [],
        confusing_grammar: parsed.confusing_grammar || [],
        formality_exercise: parsed.formality_exercise || null,
        culture_note: (parsed.culture_note as string) || '',
        status: 'approved',
        admin_edited: false,
        updated_at: new Date().toISOString(),
      }

      const { error } = await sb.from('study_daily_content').upsert(rec, { onConflict: 'scheduled_date,level' })
      if (error) throw new Error(error.message)

      // Pre-generate Key Expressions + Situation Quiz for the same
      // (date, level, topic) so the FIRST learner who opens KE on
      // this day sees no AI delay — content is already in
      // grammar_examples_cache. Best-effort: failures here don't
      // bubble up because the daily content itself already saved.
      const topic = forceTopic || { ko: rec.topic_ko, en: rec.topic_en }
      if (topic.ko) {
        try {
          await pregenKeyExpressions(sb, apiKey, item.date, item.level, topic)
        } catch (_) { /* swallow — daily content is the contract */ }
      }

      return { date: item.date, level: item.level }
    }))

    settled.forEach((r, i) => {
      const item = missing[i]
      if (r.status === 'fulfilled') {
        results.push({ date: item.date, level: item.level, status: 'ok' })
      } else {
        results.push({ date: item.date, level: item.level, status: `error: ${(r.reason as Error)?.message || 'unknown'}` })
      }
    })

    // Second pass — backfill Key Expressions / Situation Quiz for
    // the (date, level) pairs whose daily content was already
    // present (and therefore SKIPPED above). Without this, dates
    // where study_daily_content existed but KE cache didn't would
    // never get pre-generated. pregenKeyExpressions itself is a
    // no-op when both cache rows already exist, so reruns stay
    // cheap.
    const skipped = toGenerate.filter((item) => !missing.find((m) => m.date === item.date && m.level === item.level))
    if (skipped.length) {
      // Need topic info per (date, level) — pull from study_daily_content
      // since we know it exists for these.
      const { data: existingTopics } = await sb
        .from('study_daily_content')
        .select('scheduled_date,level,topic_ko,topic_en')
        .in('scheduled_date', skipped.map((s) => s.date))
      const topicMap: Record<string, { ko: string; en: string }> = {}
      for (const r of existingTopics || []) {
        topicMap[`${r.scheduled_date}_${r.level}`] = { ko: r.topic_ko || '', en: r.topic_en || '' }
      }
      await Promise.allSettled(skipped.map(async (item) => {
        const topic = topicMap[`${item.date}_${item.level}`]
        if (!topic || !topic.ko) return
        try {
          const r = await pregenKeyExpressions(sb, apiKey, item.date, item.level, topic)
          results.push({
            date: item.date,
            level: item.level,
            status: `ke: exp=${r.expressions ? 'ok' : 'skip'} sit=${r.situations ? 'ok' : 'skip'}`,
          })
        } catch (e) {
          results.push({ date: item.date, level: item.level, status: `ke-error: ${(e as Error).message}` })
        }
      }))
    }

    if (lockHeld) await sb.from('app_settings').delete().eq('key', LOCK_KEY).then(() => {}, () => {})
    return new Response(JSON.stringify({ ok: true, dates, generated: results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = (e as Error).message || String(e)
    console.error('[daily-content-gen] critical failure:', msg)
    // Always release the lock on error — otherwise the next pg_cron run
    // sees the lock held within TTL and skips, leaving stale daily content
    // until someone manually clears the lock row. (DR-19-F8.)
    if (sbForCleanup && lockHeld) {
      await sbForCleanup.from('app_settings').delete().eq('key', LOCK_KEY).then(() => {}, () => {})
    }
    // Persist to client_errors so the operator sees this in the Discord
    // alarm + admin dashboard. Without this, the cron silently dies and
    // topics stay stale until someone notices. (DR-19-F9.)
    if (sbForCleanup) {
      await sbForCleanup.from('client_errors').insert({
        message: msg.slice(0, 500),
        context: { source: 'daily-content-gen-cron' },
        severity: 'critical',
      }).then(() => {}, () => {})
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
