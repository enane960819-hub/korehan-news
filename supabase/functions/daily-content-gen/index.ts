// Daily Content Generator — runs on cron schedule
// Generates study_daily_content for all 4 levels × today + tomorrow
// Triggered by: pg_cron → pg_net HTTP call, or manual invoke
// (Redeploy 2026-10-19: the enrichment + KE-prebake fix (PR #749) never shipped
//  because deploy-edge-function failed on an invalid SUPABASE_ACCESS_TOKEN on
//  2026-10-17. Token refreshed; this touch re-triggers the deploy so the fix
//  actually lands.)
//
// Auth accepts any of:
//   - SUPABASE_SERVICE_ROLE_KEY env var (default Supabase admin)
//   - CRON_SECRET env var (custom secret we set ourselves; preferred
//     for cron because it's stable across service-role rotations)
//   - A signed-in admin user JWT matching ADMIN_EMAIL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { NATURAL_KOREAN_RULES } from '../_shared/korean-rules.ts'
import { aiGate, AiOffError } from '../_shared/ai-gate.ts'

const ALL_LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced'] as const
type Level = typeof ALL_LEVELS[number]
// Forest (Advanced) is locked in the Study Room UI ("coming soon"), so don't
// spend nightly Sonnet calls generating content nobody can open. Add it
// back here when Forest launches; its writing_topics stay in the table.
const GEN_LEVELS: readonly Level[] = ['Starter', 'Beginner', 'Intermediate']

const ADMIN_EMAIL = 'enane960819@gmail.com'

// CRON-F13: writing-topic rotation epoch. Previously hardcoded in
// 2 spots in this file + 5 spots in korehan-x9f4k2m7.html. A
// maintainer who tweaks one (e.g. to skip a corrupted topic batch)
// will silently desync admin "preview today's topic" from cron
// generation. Extracted to one place per file; the admin page has
// its own KH_WRITING_TOPICS_EPOCH near the top — keep them in sync.
// Reset 2026-10-11 (launch prep) so the refreshed writing_topics list is
// used once in full before any topic repeats.
const WRITING_TOPICS_EPOCH_ISO = '2026-10-12T00:00:00+09:00'

// Natural-Korean rules live in _shared/korean-rules.ts (also used by content-qa).

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
// Weekly Topic: content runs Mon–Sun KST; the row's scheduled_date is that
// Monday (= kstWeekKey() in korehan-study-room.js).
function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return addDays(dateStr, -((d.getUTCDay() + 6) % 7))
}
// Weeks since the epoch (a Monday) % topic count — same as khTopicWeekIndex().
function topicWeekIndex(weekStart: string, count: number): number {
  const weeks = Math.floor((new Date(weekStart + 'T00:00:00+09:00').getTime() - new Date(WRITING_TOPICS_EPOCH_ISO).getTime()) / (7 * 86400_000))
  return Math.max(0, weeks) % count
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
${NATURAL_KOREAN_RULES}
Return ONLY valid JSON (strict RFC8259, no markdown, no comments, no trailing commas):
{"topic_ko":"...","topic_en":"...",
"vocab":[{"ko":"word","rom":"romanization","en":"meaning","level":"${level}"}],
"grammar":[{"level":"${level}","pattern":"~grammar pattern","explanation":"English explanation","example_ko":"Korean example","example_en":"English translation","examples":[{"ko":"second distinct Korean example of the SAME pattern","en":"English translation"}]}],
"helpers":[{"ko":"Full Korean example sentence about the topic","en":"English translation"}],
"dictation_sentences":[{"ko":"","en":""}],
"dictation_questions":[{"question_ko":"","answer_ko":"","hint_en":""}]${levelExtra}}
Exact counts: vocab=6, grammar=3 (each grammar item needs example_ko PLUS a 2-item "examples" array = 3 distinct sentences per pattern), helpers=7, dictation_sentences=5, dictation_questions=3${levelExtraCounts}.
IMPORTANT: "helpers" are full example SENTENCES (not single words) that a student can reference before writing.
NO REPEATS — highest priority for variety: across the ENTIRE response (every vocab example, every grammar example_ko and examples[], every helper, every dictation sentence and question) no two Korean sentences may be identical or near-duplicates (same verb + same object with only a particle or ending swapped). Each sentence must teach something the others don't — vary the subject, the vocabulary, the situation, and the sentence structure. A learner studying this topic for a week should meet ${level === 'Starter' ? '20+' : '25+'} genuinely different example sentences here, not the same handful reworded.`

  // Dynamic — changes per call. Topic hint is what the model uses
  // to generate the specific content. Placed AFTER the cache boundary.
  const dynamicSuffix = topicHint
    ? `\n\n${topicHint}`
    : ''

  return { staticPrefix, dynamicSuffix }
}

// Best-effort cost telemetry so this cron's Anthropic spend shows up in the
// cost dashboard (same claude_api_usage table claude-proxy + daily-article-draft
// write). user_id is null for cron calls — the column was made nullable in
// 20261021 (before that, cron inserts silently failed the NOT NULL check and
// cron spend was invisible). Never let telemetry break generation.
function logUsage(sb: any, feature: string, model: string, usage: Record<string, number> | undefined) {
  try {
    const u = usage || {}
    sb.from('claude_api_usage').insert({
      user_id: null,
      feature: 'cron:' + feature,
      model,
      input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      output_tokens: u.output_tokens || 0,
    }).then(() => {}, () => {})
  } catch (_) { /* swallow */ }
}

async function callAnthropic(
  sb: any,
  apiKey: string,
  prompt: { staticPrefix: string; dynamicSuffix: string },
  level: Level,
  feature = 'daily-content-gen',
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
  // 2026-05-27: Beginner 1500 was still truncating around 3.6KB output
  // (parse error at position 3627), and Advanced 3000 was truncating
  // around 6.7KB (parse error at 6735). Bumped both with comfortable
  // headroom — the marginal cost is small compared to the cost of
  // a whole-level generation failing and the user seeing stale content.
  // Budgets raised 2026-10-15 for the larger, no-repeat pools (vocab 5→6,
  // helpers 4→7, dictation 3→5, grammar now 3 sentences/pattern). Korean
  // tokenizes 2-3x heavier than English, so give comfortable headroom —
  // a truncated mid-JSON response costs a whole level's generation.
  const maxTokens =
    level === 'Advanced'     ? 4800 :
    level === 'Intermediate' ? 3200 :
    2600

  // CRON-F6: prompt-caching via cache_control on the static prefix.
  // The grammar rules + schema (~2k tokens) are identical for every
  // call of the same level, so a retry within the 5-min TTL pays
  // ~10% of full input cost. Concurrent fan-out in the main loop
  // still pays full price on the first wave (they all hit Anthropic
  // before the cache write commits) but admin-side retries and the
  // pregenKeyExpressions follow-up calls within the same window
  // benefit. The cache key is implicitly per-level since the prefix
  // includes the level name + level-specific schema extras.
  const off = await aiGate(sb, 'daily-content-gen', 'cron:' + feature)
  if (off) throw new AiOffError(off)
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
  logUsage(sb, feature, model, data.usage)
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
  try { return JSON.parse(repaired) } catch (_) { /* try truncation repair */ }
  // Last-resort: response was truncated mid-element. Strip back to the
  // last comma at top-level scope and close the outer object. Caller
  // receives a partial object (some fields missing) — better than the
  // whole-level generation failing and stranding users on stale content.
  const tail = repaired.lastIndexOf(',')
  if (tail > 0) {
    try { return JSON.parse(repaired.slice(0, tail) + '}') } catch (_) { /* fall through */ }
  }
  throw new Error(`JSON parse failed even after repair (response likely truncated past max_tokens at ${clean.length} chars)`)
}

// Parse an Anthropic response that's expected to start/end with [ ... ].
// Mirrors the object-parser above but for top-level arrays — used by
// the Key Expressions + situation-quiz pre-gen that returns a JSON
// array of items instead of a wrapping object.
async function callAnthropicArray(sb: any, apiKey: string, prompt: string, model: string, maxTokens: number, feature = 'daily-content-gen-ke'): Promise<unknown[]> {
  const off = await aiGate(sb, 'daily-content-gen', 'cron:' + feature)
  if (off) throw new AiOffError(off)
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
  logUsage(sb, feature, model, data.usage)
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

// Pre-generate the step-5 "Key Expressions" list for a given
// (level, topic) and stash it into grammar_examples_cache under the
// EXACT key + schema the Study Room's openKeyExpressionsModal() reads
// at its cross-user DB cache step (path 3):
//   kex5::<topic_ko>_<level>  →  { expressions: [ {ko,rom,en,parts,examples} ×6 ] }
// (client: `'kex5::' + topicKoKey + '_' + levelKey`, no date — topic_ko
//  is stable across the week). When this row exists the first learner to
// open Key Expressions gets it instantly from DB instead of waiting ~15s
// for a cold Claude generation. One generation serves every learner on
// that day's topic (audit 2026-10-15, study-room #5).
//
// Re-enabled 2026-10-15. The 2026-10-12 OFF note: the old version wrote a
// `kex::…` key in a flat {ko,rom,en,example_ko,example_en} schema that the
// client never reads (it looks up `kex5::` and needs parts[] + examples[]),
// so it burned credit without ever producing a cache hit. This version uses
// the client's own key, prompt, and quality filter, so a pre-baked row is
// byte-for-byte the shape openKeyExpressionsModal() expects. The situation
// quiz is NOT pre-baked here: its client key (_keSitCacheKey) is built from
// _todayTopic.id, which this cron can't reconstruct, and the client already
// background-prefetches it the moment expressions render.
const PREGEN_KEY_EXPRESSIONS = true

// Mirror of the Study Room client's REDUNDANT filter (korehan-study-room.js
// openKeyExpressionsModal) — rejects AI output with redundant Korean like
// "독서 읽는 것" (독서 already means "reading"). Kept in sync so a pre-baked
// row never contains items the client would have filtered out itself.
const KE_REDUNDANT = /(독서[\s가-힣]*읽|음식[\s가-힣]*먹|영화[\s가-힣]*보는 것을 보)/

async function pregenKeyExpressions(
  sb: ReturnType<typeof createClient>,
  apiKey: string,
  _date: string,
  level: Level,
  topic: { ko: string; en: string },
): Promise<{ expressions: boolean; situations: boolean }> {
  if (!PREGEN_KEY_EXPRESSIONS) return { expressions: false, situations: false }

  const expressionsKey = `kex5::${topic.ko}_${level}`

  // Skip if already baked — keeps nightly reruns cheap (prefer DB reuse).
  const { data: existing } = await sb
    .from('grammar_examples_cache')
    .select('pattern_name,patterns_json')
    .eq('pattern_name', expressionsKey)
    .maybeSingle()
  if (existing?.patterns_json) {
    try {
      const parsed = JSON.parse(existing.patterns_json as string)
      if (Array.isArray(parsed?.expressions) && parsed.expressions.length) {
        return { expressions: true, situations: false }
      }
    } catch (_) { /* malformed — regenerate below */ }
  }

  // Prompt is a faithful port of openKeyExpressionsModal()'s client prompt
  // so the generated schema (ko / rom / en / parts[] / examples[]) matches
  // exactly what _renderKeyExpressions() consumes.
  const expPrompt =
    `You are a Korean language teacher. Generate EXACTLY 6 reusable Korean EXPRESSIONS (sentence patterns / collocations / set phrases) for a learner studying the topic: "${topic.ko}" (${topic.en}). Level: ${level}.\n\n` +
    `You MUST teach each expression as a PATTERN with explicit breakdown — not a one-off sentence.\n\n` +
    `OUTPUT FORMAT — return ONLY a JSON array of 6 items, no markdown, no commentary:\n` +
    `[{\n` +
    `  "ko": "the expression in PATTERN form (use ~ for variable slots, e.g. \\"~하는 것이 취미다\\", \\"~을/를 자주 V\\", \\"~에 시간이 날 때마다\\")",\n` +
    `  "rom": "romanization of the pattern",\n` +
    `  "en": "natural English meaning of the pattern",\n` +
    `  "parts": [\n` +
    `    {"ko":"~하는", "en":"V + 는 (present-tense modifier)"},\n` +
    `    {"ko":"것이",  "en":"the act of (nominalizer + subject)"},\n` +
    `    {"ko":"취미다","en":"is a hobby"}\n` +
    `  ],\n` +
    `  "examples": [\n` +
    `    {"ko":"NATURAL Korean sentence using the pattern with one specific content word","en":"English translation"},\n` +
    `    {"ko":"NATURAL Korean sentence using the pattern with a DIFFERENT content word in the slot","en":"English translation"}\n` +
    `  ]\n` +
    `}]\n\n` +
    `STRICT RULES:\n` +
    `1. ko: pattern form with ~ or V marking the variable slots. NEVER a fully-instantiated single sentence. Good: "~하는 것이 취미다", "~을/를 잘 V". Bad: "책 읽는 것이 취미다" (no variable slot — that's an example, not the pattern).\n` +
    `2. CRITICAL — the verb is part of the slot, not part of the pattern. If the pattern is about a fixed adverb + any action verb (e.g. "~을/를 잘 V"), examples MUST use the actual action verb, not 해요. WRONG: "그림을 잘 해요" (해요 doesn't belong; the action is 그리다). RIGHT: "그림을 잘 그려요". Never substitute 해요 for an arbitrary verb just to fill the slot.\n` +
    `3. parts: 2-4 items breaking the pattern into its grammatical pieces, each with a SHORT plain-English explanation of what that piece does. The most important "new" word/grammar must appear here (e.g. for "~을/를 자주 V" the parts MUST include 자주 = "often, frequently").\n` +
    `4. examples: 2 sentences that REUSE the pattern with DIFFERENT content words in the slot. They must demonstrate variability. Each example must be GRAMMATICALLY VALID Korean a native would actually say.\n` +
    `5. NEVER generate redundant Korean. Forbidden: "독서 읽는 것을 좋아하다" (독서 already means "reading"). Use either the noun form (독서를 좋아하다) OR the verbal form (책 읽는 것을 좋아하다), never both.\n` +
    `6. Mix expression types across the 6: grammar patterns (~고 싶다, ~는 편이다, ~(으)ㄴ/는 것 같다, ~ㄹ 때마다), collocations (시간이 나다, 손이 크다, 기분이 좋아지다), set phrases (오랜만이에요, 시간 가는 줄 모르다).\n` +
    `7. Each expression must be naturally usable when talking about today's topic — not generic filler.\n\n` +
    `KOREAN GRAMMAR RULES for every examples[].ko sentence:\n` +
    `1. PSYCH-VERB 1st/3rd:\n` +
    `   1st-person (저/나/우리) → bare feeling form: 저는 슬퍼요 / 저는 가고 싶어요.\n` +
    `   3rd-person (그/그녀/이름/사람들/아이들) → "-아/어 하다" form:\n` +
    `   ✓ 동생은 슬퍼해요 / 아이들은 만들고 싶어 해요\n` +
    `   ✗ 동생은 슬퍼요 / 아이들은 만들고 싶어요\n` +
    `   Applies to: 싶다, 슬프다, 기쁘다, 무섭다, 싫다, 부끄럽다, 좋다.\n` +
    `2. SUBJECT-PARTICLE CONSISTENCY: no 은/는 ↔ 이/가 flipping for same referent.\n` +
    `3. FORMALITY: match the level's register (Starter/Beginner → 해요체;\n` +
    `   Intermediate/Advanced may use 합쇼체 or 평어체) — and within ONE example sentence do not mix registers.\n` +
    `4. TENSE AGREEMENT within a clause vs the temporal anchor.\n` +
    `5. SPACING: 가고 싶다 ✓ / 가고싶다 ✗; tense endings attach to the stem (갔다 ✓, 가았다 ✗).`

  try {
    const arr = await callAnthropicArray(sb, apiKey, expPrompt, 'claude-haiku-4-5-20251001', 1800)
    // Same quality filter as the client so a pre-baked row is identical to
    // what the client would have cached itself.
    const expressions = (arr || []).filter((x) => {
      const item = x as { ko?: string; examples?: Array<{ ko?: string }> }
      if (!item || typeof item.ko !== 'string') return false
      const ko = item.ko.trim()
      if (ko.indexOf(' ') === -1 && ko.length < 4) return false
      if (KE_REDUNDANT.test(ko)) return false
      if (Array.isArray(item.examples) && item.examples.some((ex) => ex && ex.ko && KE_REDUNDANT.test(ex.ko))) return false
      return true
    })
    if (expressions.length) {
      await sb.from('grammar_examples_cache').upsert({
        pattern_name:  expressionsKey,
        patterns_json: JSON.stringify({ expressions }),
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'pattern_name' })
      return { expressions: true, situations: false }
    }
  } catch (_) {
    // Best-effort: a KE failure must never break the daily-content pipeline.
  }
  return { expressions: false, situations: false }
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

    // Determine weeks: this week + next week (rows keyed by Monday, KST)
    const thisWeek = weekKey(kstToday())
    const dates = [thisWeek, addDays(thisWeek, 7)]

    // Build full generation list: today + tomorrow × all levels
    // Always generate — upsert overwrites stale/wrong topics
    const toGenerate: Array<{ date: string; level: Level }> = []
    for (const date of dates) {
      for (const level of GEN_LEVELS) {
        toGenerate.push({ date, level })
      }
    }

    // Check existing content to skip only if topic matches expected rotation
    const { data: existing } = await sb
      .from('study_daily_content')
      .select('scheduled_date,level,vocab,topic_ko,helpers,grammar,enrich_attempts')
      .in('scheduled_date', dates)

    const existingMap: Record<string, { hasVocab: boolean; topic_ko: string; enriched: boolean; attempts: number }> = {}
    for (const r of existing || []) {
      const hasVocab = r.vocab && (Array.isArray(r.vocab) ? r.vocab.length > 0 : typeof r.vocab === 'string' && r.vocab.length > 2)
      // "Enriched" = the richer no-repeat schema (helpers ≥ 7 AND each grammar
      // item carries an examples[] array). Rows generated before that upgrade
      // are regenerated once so existing weeks aren't stuck at 4 helpers / no
      // extra examples.
      const hArr = Array.isArray(r.helpers) ? r.helpers : []
      const gArr = Array.isArray(r.grammar) ? r.grammar : []
      const grammarHasEx = gArr.some((g: { examples?: unknown[] }) => g && Array.isArray(g.examples) && g.examples.length > 0)
      const enriched = hArr.length >= 7 && grammarHasEx
      existingMap[`${r.scheduled_date}_${r.level}`] = { hasVocab: !!hasVocab, topic_ko: r.topic_ko || '', enriched, attempts: Number(r.enrich_attempts) || 0 }
    }

    // Topic per (week, level). A week that already has a row keeps its topic —
    // the old "wrong topic → regenerate" rule re-billed and changed topics
    // whenever the rotation list shifted. A new week takes the rotation pick,
    // skipping any topic that level used in the last 12 weeks.
    //
    // Why: every writing_topics row has sort_order 0 and the same created_at
    // (bulk insert), so `order(sort_order, created_at)` was a tie and Postgres
    // could return the list in a different order on each run. Weeks then
    // mapped to arbitrary topics and Starter got "내 가족" on both 10-19 and
    // 10-26. `id` breaks the tie; the recent-use check guards against the
    // index shifting when topics are (de)activated or reordered.
    const pickedTopics: Record<string, { ko: string; en: string; category: string }> = {}
    const firstWeek = dates[0]
    for (const level of GEN_LEVELS) {
      const { data: topics } = await sb
        .from('writing_topics')
        .select('id,topic_ko,topic_en,category')
        .eq('level', level)
        .eq('active', true)
        .order('sort_order')
        .order('created_at')
        .order('id')
      const allTopics = topics || []
      const { data: recent } = await sb
        .from('study_daily_content')
        .select('topic_ko')
        .eq('level', level)
        .gte('scheduled_date', addDays(firstWeek, -84))
        .lt('scheduled_date', firstWeek)
      const used = new Set((recent || []).map((r: { topic_ko: string }) => r.topic_ko).filter(Boolean))
      for (const date of dates) {
        const ex = existingMap[`${date}_${level}`]
        if (ex && ex.topic_ko) {
          const t = allTopics.find((x: { topic_ko: string }) => x.topic_ko === ex.topic_ko)
          pickedTopics[`${date}_${level}`] = { ko: ex.topic_ko, en: t?.topic_en || '', category: t?.category || '' }
          used.add(ex.topic_ko)
          continue
        }
        if (!allTopics.length) continue
        const start = topicWeekIndex(date, allTopics.length)
        let t = allTopics[start]
        for (let k = 0; k < allTopics.length; k++) {
          const c = allTopics[(start + k) % allTopics.length]
          if (!used.has(c.topic_ko)) { t = c; break }
        }
        pickedTopics[`${date}_${level}`] = { ko: t.topic_ko, en: t.topic_en, category: t.category || '' }
        used.add(t.topic_ko)
      }
    }

    // Filter: generate rows that are missing or have no vocab, plus old-schema
    // rows (thin helpers / no grammar examples) up to MAX_ENRICH_ATTEMPTS times
    // so a row that never reaches the enriched bar isn't re-billed every night.
    const missing = toGenerate.filter(item => {
      const ex = existingMap[`${item.date}_${item.level}`]
      if (!ex || !ex.hasVocab) return true
      if (!ex.enriched && (ex.attempts || 0) < 2) return true
      return false
    })

    // NOTE: we intentionally do NOT early-return when `missing` is empty.
    // The Key Expressions pre-bake backfill below must still run for dates
    // whose study_daily_content already exists but whose KE cache rows were
    // never generated (e.g. weeks created before the pre-bake landed).

    const results: Array<{ date: string; level: string; status: string }> = []

    // Generate all missing items in parallel. The previous sequential
    // for-loop with 2s gaps blew past Supabase's wall-clock kill timer
    // — 8 items × ~10-30s each + waits = 100s+ which exceeded the
    // function's hard limit, so only 2-3 items would land before the
    // runtime killed it. Anthropic Haiku tolerates this many concurrent
    // calls fine, and the worst-case wall time drops from O(n) to O(1).
    const settled = await Promise.allSettled(missing.map(async (item) => {
      // 22차 audit: refuse to generate content if writing_topics is empty
      // for this level — fail loud so the operator seeds the topics table.
      const t = pickedTopics[`${item.date}_${item.level}`]
      if (!t || !t.ko) {
        throw new Error(`writing_topics table is empty for level ${item.level} — seed topics before running daily-content-gen`)
      }
      const topicHint = `Use EXACTLY this topic: "${t.ko}" (${t.en}). Category: ${t.category || ''}.`
      const forceTopic: { ko: string; en: string } | null = { ko: t.ko, en: t.en }

      const prompt = buildPrompt(item.level, topicHint)
      const parsed = await callAnthropic(sb, apiKey, prompt, item.level)

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
        // Count this generation toward the per-row enrichment cap (the missing
        // filter stops regenerating once this reaches 2). New rows start at 1.
        enrich_attempts: ((existingMap[`${item.date}_${item.level}`]?.attempts) || 0) + 1,
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
