// content-qa — automatic quality gate for generated learning content.
//
// Runs on a pg_cron schedule (and can be invoked manually). For this week
// and next week, per level:
//   1. Reviews the week's study_daily_content (vocab glosses, grammar
//      examples, helper / dictation sentences) with a strict native-teacher
//      pass and drops — or, for a vocab gloss, corrects — anything flagged.
//   2. Reviews the pre-baked Key Expressions list (grammar_examples_cache
//      kex5::<topic>_<level>) the same way.
//   3. Builds the writing-flow topic pack (writing_topic_content) if the
//      topic has none: generate → structural checks → every frame
//      combination + every sentence / word order / gloss reviewed →
//      flagged options removed. Only a pack that survives is saved.
// Nothing here needs the owner to review content by hand; anything the
// reviewer is unsure about is removed, never shown.
//
// Auth: service_role, CRON_SECRET (pg_cron via Vault), or the admin JWT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { NATURAL_KOREAN_RULES } from '../_shared/korean-rules.ts'
import { type Line, type Pack, validatePack, comboLines, dropBadOptions, sentenceLines, applySentenceFlags } from './pack.ts'
import { type ContentRow, type Flag, contentLines, applyContentFlags, keLines, applyKeFlags } from './content.ts'

const GEN_LEVELS = ['Starter', 'Beginner', 'Intermediate'] as const
const ADMIN_EMAIL = 'enane960819@gmail.com'
const MODEL = 'claude-sonnet-4-6'
const MAX_PACK_ATTEMPTS = 3          // per topic+level, ever — never re-bill forever
const BUDGET_MS = 100_000            // stop starting new review steps after this
const PACK_WEEKS_AHEAD = 3           // build packs up to 3 weeks before they are used

const LEVEL_GUIDE: Record<string, string> = {
  Starter: 'STARTER (TOPIK 0): very short 해요체 sentences (2-5 words), only the most basic words, ~이에요/예요, ~아요/어요, ~을/를 좋아해요.',
  Beginner: 'BEGINNER (TOPIK 1-2): short 해요체 present-tense sentences (4-8 words), everyday words, ~아서/어서, ~(으)면서, ~고 싶어요.',
  Intermediate: 'INTERMEDIATE (TOPIK 3-4): 해요체, past and present, connectors (~는데, ~거든요, ~(으)니까, ~는 편이에요), 6-12 words per sentence.',
}

// A hand-written, reviewed pack (Beginner) — the shape to copy.
const EXAMPLE_PACK = {"format": {"label": "Short answer · 3–5 sentences", "hint": "Say which time you like and why — like telling a friend."}, "min_sentences": 3, "models": [{"ko": "저는 아침이 제일 좋아요.", "en": "I like mornings the most.", "hl": ["이 제일 좋아요"]}, {"ko": "아침에는 조용해서 공부가 잘 돼요.", "en": "It's quiet in the morning, so I can focus.", "hl": ["해서"]}, {"ko": "그리고 커피를 마시면서 하루를 시작해요.", "en": "And I start my day with a coffee.", "hl": ["면서"]}], "patterns": [{"name": "~이/가 제일 좋아요", "exp": "Say what you like most.", "ex_ko": "저는 저녁이 제일 좋아요.", "ex_en": "I like evenings the most.", "match": ["제일 좋아", "가장 좋아"]}, {"name": "~아서/어서", "exp": "Reason → result.", "ex_ko": "날씨가 좋아서 산책했어요.", "ex_en": "The weather was nice, so I took a walk.", "match": ["아서", "어서", "해서", "워서", "러서"]}, {"name": "~(으)면서", "exp": "Two things at once.", "ex_ko": "음악을 들으면서 쉬어요.", "ex_en": "I relax while listening to music.", "match": ["면서"]}], "frames": [{"parts": ["저는 ", {"slot": true, "options": ["아침", "점심시간", "저녁", "밤", "새벽"], "options_en": ["morning", "lunchtime", "evening", "night", "dawn"], "josa": "이/가", "ph": "…"}, " 제일 좋아요."], "en": "I like ___ the most."}, {"parts": ["그때는 ", {"slot": true, "options": ["여유가 있어서", "마음이 편해서", "혼자 있을 수 있어서", "좋아하는 일을 할 수 있어서"], "options_en": ["I have free time", "I feel at ease", "I can be alone", "I can do what I love"], "josa": null, "ph": "…"}, " 기분이 좋아요."], "en": "I feel good then because ___."}, {"parts": ["보통 ", {"slot": true, "options": ["음악을 들으면서", "커피를 마시면서", "산책하면서", "드라마를 보면서"], "options_en": ["listening to music", "drinking coffee", "taking a walk", "watching dramas"], "josa": null, "ph": "…"}, " 쉬어요."], "en": "I usually relax while ___."}], "words": ["아침", "저녁", "점심", "밤", "새벽", "제일", "가장", "좋아", "쉬"], "checklist": [{"label": "Say which time you like", "any": ["아침", "점심", "저녁", "밤", "새벽", "오후", "오전"]}, {"label": "Give a reason (~아서/어서)", "any": ["@reason", "니까", "때문에"]}, {"label": "Try ~(으)면서", "any": ["면서"], "optional": true}], "model_answer": "저는 저녁이 제일 좋아요. 저녁에는 일이 끝나서 마음이 편해요. 보통 음악을 들으면서 쉬어요. 가끔 친구를 만나서 같이 저녁을 먹어요.", "sentences": [{"ko": "저는 저녁이 제일 좋아요.", "en": "I like evenings the most.", "acceptable_orders": []}, {"ko": "저녁에는 일이 끝나서 마음이 편해요.", "en": "Work is over in the evening, so I feel relaxed.", "acceptable_orders": []}, {"ko": "보통 음악을 들으면서 쉬어요.", "en": "I usually relax while listening to music.", "acceptable_orders": []}, {"ko": "가끔 친구를 만나서 같이 저녁을 먹어요.", "en": "Sometimes I meet a friend and we have dinner together.", "acceptable_orders": ["가끔 친구를 만나서 저녁을 같이 먹어요."]}, {"ko": "그래서 저는 저녁 시간을 기다려요.", "en": "So I look forward to the evening.", "acceptable_orders": []}]}

function kstToday(): string { return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10) }
function addDays(d: string, n: number): string { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
// Same rotation as daily-content-gen / khTopicWeekIndex (keep in sync).
const WRITING_TOPICS_EPOCH_ISO = '2026-10-12T00:00:00+09:00'
function topicWeekIndex(weekStart: string, count: number): number {
  const weeks = Math.floor((new Date(weekStart + 'T00:00:00+09:00').getTime() - new Date(WRITING_TOPICS_EPOCH_ISO).getTime()) / (7 * 86400_000))
  return Math.max(0, weeks) % count
}
function weekKey(d: string): string { const x = new Date(d + 'T00:00:00Z'); return addDays(d, -((x.getUTCDay() + 6) % 7)) }

function logUsage(sb: any, feature: string, usage: Record<string, number> | undefined) {
  try {
    const u = usage || {}
    sb.from('claude_api_usage').insert({
      user_id: null, feature: 'cron:' + feature, model: MODEL,
      input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      output_tokens: u.output_tokens || 0,
    }).then(() => {}, () => {})
  } catch (_) { /* telemetry never breaks QA */ }
}

// The first complete {...} in a model reply — models sometimes add a note
// after the JSON (which may itself contain braces), so lastIndexOf('}')
// isn't safe. String-aware brace matching.
function firstJsonObject(raw: string): string {
  const start = raw.indexOf('{')
  if (start < 0) return ''
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1) }
  }
  return raw.slice(start)   // truncated — let JSON.parse report it
}

// One retry when the model returns malformed JSON (an unescaped quote in
// Korean text happens now and then) — cheaper than losing the whole step.
async function claudeJson(sb: any, apiKey: string, prompt: string, maxTokens: number, feature: string): Promise<any> {
  try { return await claudeJsonOnce(sb, apiKey, prompt, maxTokens, feature) } catch (e) {
    if (!/JSON|Unexpected|Expected/.test(String((e as Error).message))) throw e
    return await claudeJsonOnce(sb, apiKey, prompt + '\n\nReturn strictly valid JSON: escape every double quote inside strings.', maxTokens, feature + '-retry')
  }
}
async function claudeJsonOnce(sb: any, apiKey: string, prompt: string, maxTokens: number, feature: string): Promise<any> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`)
  const data = await resp.json()
  logUsage(sb, feature, data.usage)
  const raw = (data.content || []).map((c: { text?: string }) => c.text || '').join('').replace(/```json|```/g, '').trim()
  const clean = firstJsonObject(raw)
  if (!clean) throw new Error('No JSON in response')
  try { return JSON.parse(clean) } catch (_) { return JSON.parse(clean.replace(/,(\s*[}\]])/g, '$1')) }
}

// Strict native-teacher review. Returns the flagged ids (+ optional fix_en).
async function review(sb: any, apiKey: string, level: string, topic: string, lines: Line[], what: string): Promise<Flag[]> {
  const chunks: Line[][] = []
  for (let i = 0; i < lines.length; i += 90) chunks.push(lines.slice(i, i + 90))
  const results = await Promise.all(chunks.map((chunk) => claudeJson(sb, apiKey,
    `You are a strict native Korean teacher checking ${what} for ${level} learners (topic: "${topic}").\n` +
    `Flag EVERY line a native Korean teacher would mark: unnatural, awkward or translated-sounding Korean; redundancy (the same noun repeated, e.g. 번호는 새 번호예요); anything a native speaker would phrase differently; a word order that is grammatical but not how people actually say it; wrong particle, spacing or conjugation; two sentences that don't make sense together; a wrong or mismatched English translation or meaning. When in doubt, flag it — a flagged line is simply removed, so false alarms are cheap and misses are expensive. Do not flag lines that are fully natural and correct.\n` +
    `For a MEANING CHECK or GLOSS CHECK line that is wrong, include "fix_en" with the correct short English meaning. Only list lines that have a real problem — never list a line just to say it is fine.\n\n` +
    `Return ONLY JSON: {"bad":[{"id":"...","reason":"short English reason","fix_en":"only for MEANING CHECK"}]}\n\nLines (id | text):\n` +
    chunk.map((l) => `${l.id} | ${l.text}`).join('\n'),
    1500, 'content-qa-review')))
  const ids = new Set(lines.map((l) => l.id))
  // The reviewer sometimes flags a line while saying it is fine ("both orders
  // are fully natural … should not be flagged") — those are not problems.
  const notReally = /(should not be flagged|not (a |an )?(problem|issue|error)|no (real )?(issue|problem)|(is|are|sounds?) (fully|completely|perfectly) (natural|fine|correct|acceptable)|both [^.]{0,40}(natural|correct|fine)|acceptable as is)/i
  return results.flatMap((r) => (Array.isArray(r?.bad) ? r.bad : []))
    .filter((f: Flag) => f && ids.has(f.id) && !notReally.test(String(f.reason || '')))
}

function packPrompt(level: string, topicKo: string, topicEn: string, feedback: string): string {
  return `You write a writing-practice content pack for adult foreign learners of Korean.\n` +
    `Topic (the question the learner answers): "${topicKo}" (${topicEn}). Level: ${LEVEL_GUIDE[level]}\n\n` +
    `Return ONLY JSON in exactly this shape (this example is a finished pack for another topic — copy the structure, not the content):\n` +
    JSON.stringify(EXAMPLE_PACK) + `\n\n` +
    `Rules:\n` +
    `- format.label: "Short answer · N–M sentences"; format.hint: one short English sentence on what to say.\n` +
    `- models: 3 short natural answers to the topic; "hl" = exact substrings of ko that show the pattern.\n` +
    `- patterns: 3 patterns used in the models; "match" = exact Korean substrings that prove the pattern is used.\n` +
    `- frames: EXACTLY 3 sentence frames that together make a short answer. Each frame has EXACTLY ONE slot {"slot":true,"options":[3-4 Korean options],"options_en":[short English gloss for each option, same order],"josa":EXACTLY one of null,"이/가","을/를","은/는","이에요/예요","에","에서" — nothing else; any other ending goes in the frame text,"ph":"…"} and "en" = the frame in English with ___.\n` +
    `  * Options are bare words/phrases — the particle in "josa" is attached automatically, so never write it in the option.\n` +
    `  * Options are Korean words or phrases a learner can say about THEMSELVES — never numbers, phone numbers, codes or English. Don't ask for personal data.\n` +
    `  * CRITICAL: the learner fills the three frames independently. EVERY option must make a natural sentence in its frame AND read naturally next to EVERY option of the other two frames. Never let an option depend on another frame's choice. Bad: frame 1 "아침/저녁" + frame 2 "일이 끝나서" (only fits evening). Bad: frame 1 "칼국수집/카페" + frame 3 "파스타". Choose options that are true whatever else is picked.\n` +
    `- words: 5-8 key Korean words or stems for the topic.\n` +
    `- checklist: 2-3 items {"label":English,"any":[Korean substrings, any one satisfies it],"optional":true on at most one}. "@reason" is a special token meaning "any ~아서/어서 reason". model_answer must satisfy every non-optional item.\n` +
    `- model_answer: one natural paragraph answering the topic (${level === 'Starter' ? '3-4' : level === 'Beginner' ? '4' : '4-5'} sentences).\n` +
    `- sentences: 5 short connected story sentences about the topic, each {"ko","en","acceptable_orders":[...]}. acceptable_orders = OTHER orders of exactly the same 어절 that a native speaker finds completely natural with the same meaning. If not 100% sure, use []. Never include an order that is even slightly marked.\n` +
    `- All Korean in 해요체, correct spacing, no emojis.\n` +
    NATURAL_KOREAN_RULES +
    (feedback ? `\nA previous attempt for this topic was rejected because: ${feedback}\nAvoid those problems.\n` : '')
}

async function buildPack(sb: any, apiKey: string, level: string, topicKo: string, topicEn: string, feedback: string): Promise<{ pack?: Pack; why?: string }> {
  const raw = await claudeJson(sb, apiKey, packPrompt(level, topicKo, topicEn, feedback), 4000, 'content-qa-pack')
  const { pack, errors } = validatePack(raw, level)
  if (!pack) return { why: 'structure: ' + errors.join('; ') }
  const { lines, picksById } = comboLines(pack.frames)
  const [comboFlags, sentFlags] = await Promise.all([
    review(sb, apiKey, level, topicKo, lines, 'sentence-frame combinations (P lines are two sentences from the same short answer — flag them if they clash or read oddly together)'),
    review(sb, apiKey, level, topicKo, sentenceLines(pack), 'a writing lesson (example sentences, a model answer, word orders and word glosses)'),
  ])
  if (!dropBadOptions(pack, comboFlags.map((f) => f.id), picksById)) {
    return { why: 'frame options clash: ' + comboFlags.slice(0, 4).map((f) => f.reason).join('; ') }
  }
  const fixes: Record<string, string> = {}
  sentFlags.forEach((f) => { if (f.fix_en && /^E\d/.test(f.id)) fixes[f.id] = String(f.fix_en).slice(0, 60) })
  const r = applySentenceFlags(pack, sentFlags.map((f) => f.id), level, fixes)
  if (!r.ok) return { why: r.why + ': ' + sentFlags.slice(0, 4).map((f) => f.reason).join('; ') }
  pack.auto = { generated_at: new Date().toISOString(), model: MODEL }
  return { pack }
}

async function runLog(sb: any, key: string): Promise<{ attempts: number; last_error: string }> {
  const { data } = await sb.from('content_qa_runs').select('attempts,last_error').eq('key', key).maybeSingle()
  return { attempts: data?.attempts || 0, last_error: data?.last_error || '' }
}
async function setRunLog(sb: any, key: string, attempts: number, lastError: string) {
  await sb.from('content_qa_runs').upsert({ key, attempts, last_error: lastError.slice(0, 900), updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

Deno.serve(async (req) => {
  const started = Date.now()
  const timeLeft = () => BUDGET_MS - (Date.now() - started)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const ok = (token && token === serviceKey) || (cronSecret.length >= 32 && token === cronSecret)
    if (!ok) {
      const check = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: Deno.env.get('SUPABASE_ANON_KEY') || serviceKey } })
      const user = check.ok ? await check.json() : null
      if (!user?.email || user.email !== ADMIN_EMAIL) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const sb = createClient(supabaseUrl, serviceKey)

    // One run at a time (a manual invoke + the cron must not double-bill).
    const lock = await runLog(sb, 'lock')
    const { data: lockRow } = await sb.from('content_qa_runs').select('updated_at').eq('key', 'lock').maybeSingle()
    if (lockRow && lock.attempts === 1 && Date.now() - new Date(lockRow.updated_at).getTime() < 10 * 60_000) {
      return new Response(JSON.stringify({ ok: false, error: 'already running' }), { status: 409 })
    }
    await setRunLog(sb, 'lock', 1, '')

    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) throw new Error('No Anthropic API key')

    const thisWeek = weekKey(kstToday())
    const dates = [thisWeek, addDays(thisWeek, 7)]
    const { data: rows } = await sb.from('study_daily_content')
      .select('scheduled_date,level,topic_ko,topic_en,vocab,grammar,helpers,dictation_sentences,dictation_questions,confusing_grammar,updated_at,qa_at')
      .in('scheduled_date', dates).in('level', GEN_LEVELS as unknown as string[])
    const report: Array<Record<string, unknown>> = []
    let didReview = false   // content / KE reviewed this run → packs wait for the next run

    await Promise.all((rows || []).map(async (row: any) => {
      const tag = `${row.scheduled_date} ${row.level}`
      const topicKo = String(row.topic_ko || '')
      if (!topicKo) return

      // 1) Weekly content — new or regenerated since the last check.
      const stale = !row.qa_at || new Date(row.updated_at).getTime() > new Date(row.qa_at).getTime() + 60_000
      if (stale && body.only !== 'packs' && timeLeft() > 30_000) {
        try {
          didReview = true
          const flags = await review(sb, apiKey, row.level, topicKo, contentLines(row as ContentRow), 'a week of study content (vocabulary meanings, grammar examples, example and dictation sentences)')
          const { patch, dropped } = applyContentFlags(row as ContentRow, flags)
          const now = new Date(Date.now() + 120_000).toISOString()  // ahead of any updated_at trigger
          const { error } = await sb.from('study_daily_content').update({ ...patch, qa_at: now, qa_report: { dropped, flags } })
            .eq('scheduled_date', row.scheduled_date).eq('level', row.level)
          report.push({ tag, step: 'content', dropped, error: error?.message })
        } catch (e) { report.push({ tag, step: 'content', error: (e as Error).message }) }
      }

      // 2) Pre-baked Key Expressions for this topic.
      if (body.only !== 'packs' && timeLeft() > 30_000) {
        const key = `kex5::${topicKo}_${row.level}`
        try {
          const { data: ke } = await sb.from('grammar_examples_cache').select('patterns_json').eq('pattern_name', key).maybeSingle()
          const parsed = ke?.patterns_json ? JSON.parse(ke.patterns_json) : null
          if (parsed && Array.isArray(parsed.expressions) && parsed.expressions.length && !parsed.qa) {
            didReview = true
            const flags = await review(sb, apiKey, row.level, topicKo, keLines(parsed.expressions), 'Key Expressions (reusable patterns and their example sentences)')
            const { list, dropped } = applyKeFlags(parsed.expressions, flags)
            if (list.length) {
              await sb.from('grammar_examples_cache').update({ patterns_json: JSON.stringify({ expressions: list, qa: true }), updated_at: new Date().toISOString() }).eq('pattern_name', key)
            } else {
              await sb.from('grammar_examples_cache').delete().eq('pattern_name', key)   // client regenerates
            }
            report.push({ tag, step: 'ke', dropped })
          }
        } catch (e) { report.push({ tag, step: 'ke', error: (e as Error).message }) }
      }

    }))

    // 3) Writing-flow topic packs — this week through PACK_WEEKS_AHEAD, from
    // the writing_topics rotation, so a pack is ready well before its week.
    if (body.only !== 'content') {
      const want: Array<{ week: string; level: string; ko: string; en: string }> = []
      for (const level of GEN_LEVELS) {
        const { data: topics } = await sb.from('writing_topics').select('topic_ko,topic_en')
          .eq('level', level).eq('active', true).order('sort_order').order('created_at')
        const list = topics || []
        if (!list.length) continue
        for (let w = 0; w <= PACK_WEEKS_AHEAD; w++) {
          const week = addDays(thisWeek, 7 * w)
          const t = list[topicWeekIndex(week, list.length)]
          if (!want.find((x) => x.ko === t.topic_ko && x.level === level)) want.push({ week, level, ko: t.topic_ko, en: t.topic_en || '' })
        }
      }
      // One pack per run, soonest week first, and only on a run that did no
      // other review: a pack (generate + two reviews) takes ~1.5 min and the
      // function is killed at 150 s. The hourly cron works through the rest.
      const { data: have } = await sb.from('writing_topic_content').select('topic_ko,level').in('topic_ko', want.map((x) => x.ko))
      const { data: runs } = await sb.from('content_qa_runs').select('key,attempts').like('key', 'pack::%')
      const maxed = new Set((runs || []).filter((r: any) => (r.attempts || 0) >= MAX_PACK_ATTEMPTS).map((r: any) => r.key))
      // A topic that used up its attempts must not block the topics behind it.
      const missing = want.filter((x) => !(have || []).some((h: any) => h.topic_ko === x.ko && h.level === x.level))
        .filter((x) => !maxed.has(`pack::${x.ko}|${x.level}`))
      if (maxed.size) report.push({ step: 'pack', gave_up: [...maxed].map((k) => String(k).slice(6)) })
      const next = (didReview || Date.now() - started > 20_000) ? [] : missing.slice(0, 1)
      if (missing.length > next.length) report.push({ step: 'pack', waiting: missing.slice(next.length).map((x) => `${x.week} ${x.level}`) })
      for (let i = 0; i < next.length; i += 1) {
        await Promise.all(next.slice(i, i + 1).map(async (t) => {
          const tag = `${t.week} ${t.level}`
          const topicKo = t.ko
          const row = { level: t.level, topic_en: t.en }
          {
            const { data: existing } = await sb.from('writing_topic_content').select('topic_ko').eq('topic_ko', topicKo).eq('level', row.level).maybeSingle()
            if (existing) return
            const runKey = `pack::${topicKo}|${row.level}`
            const log = await runLog(sb, runKey)
            if (log.attempts >= MAX_PACK_ATTEMPTS) { report.push({ tag, step: 'pack', skipped: 'max attempts', last_error: log.last_error }); return }
            try {
              const res = await buildPack(sb, apiKey, row.level, topicKo, String(row.topic_en || ''), log.last_error)
              if (res.pack) {
                // ignoreDuplicates: never overwrite a hand-written / already-saved pack.
                const { error } = await sb.from('writing_topic_content').upsert(
                  { topic_ko: topicKo, level: row.level, content: res.pack, reviewed: true, updated_at: new Date().toISOString() },
                  { onConflict: 'topic_ko,level', ignoreDuplicates: true })
                await setRunLog(sb, runKey, log.attempts + 1, error ? error.message : '')
                report.push({ tag, step: 'pack', saved: !error, error: error?.message })
              } else {
                await setRunLog(sb, runKey, log.attempts + 1, res.why || 'unknown')
                report.push({ tag, step: 'pack', rejected: res.why })
              }
            } catch (e) {
              await setRunLog(sb, runKey, log.attempts + 1, (e as Error).message)
              report.push({ tag, step: 'pack', error: (e as Error).message })
            }
          }
        }))
      }
    }

    // Last run's outcome, readable by the admin page (no secrets in it).
    await sb.from('content_qa_status').upsert({ id: 1, ran_at: new Date().toISOString(), ms: Date.now() - started, report }, { onConflict: 'id' }).then(() => {}, () => {})
    await sb.from('content_qa_runs').delete().eq('key', 'lock')
    return new Response(JSON.stringify({ ok: true, dates, ms: Date.now() - started, report }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = (e as Error).message || String(e)
    try {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await sb.from('content_qa_runs').delete().eq('key', 'lock')
      await sb.from('content_qa_status').upsert({ id: 1, ran_at: new Date().toISOString(), report: [{ error: msg }] }, { onConflict: 'id' })
      await sb.from('client_errors').insert({ message: msg.slice(0, 500), context: { source: 'content-qa' }, severity: 'critical' })
    } catch (_) { /* nothing else to do */ }
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
