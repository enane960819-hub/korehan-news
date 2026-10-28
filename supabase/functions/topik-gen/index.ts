// topik-gen — writes TOPIK-style practice tests at scale.
//
// Questions are ORIGINAL (never copied from past papers); the layout follows
// the real exam number by number (_shared/topik-spec.ts).
//
// Actions (POST JSON):
//   { action: 'enqueue', level: 'I'|'II', section: 'reading'|'listening', count }  admin
//   { action: 'tick' }   pg_cron worker (CRON_SECRET) — ONE step of one job:
//        gen     → write the next chunk of questions (one Claude call)
//        check   → solve that chunk blind (second Claude call); a question
//                  passes only if the blind answer equals the key and no
//                  problem is reported. Failing chunks are rewritten (max 2x);
//                  questions still failing keep qa_flag.
//        save    → topik_tests + topik_items; published when nothing is
//                  flagged, otherwise left as a draft for the admin.
//        audio   → listening: one MP3 per script with Azure neural voices
//                  (male/female), stored in the public tts-cache bucket.
//                  Skipped when Azure is not configured (the page then reads
//                  the script with the device voice).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SPEC, LEVEL_GUIDE, sectionKey, questionCount, type Block } from '../_shared/topik-spec.ts'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const MODEL = 'claude-sonnet-4-6'
const MAX_TRIES = 3
const KINDS = ['answer', 'next', 'place', 'topic', 'picture', 'graph', 'match', 'main', 'reason', 'purpose', 'action', 'blank',
  'grammar', 'similar', 'about', 'order', 'insert', 'feeling', 'headline', 'theme', 'attitude', 'manner', 'intent', 'who', 'before', 'infer', 'doing']

let cors: Record<string, string> = {}
function setCors(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const ok = ['https://korehani.com', 'https://www.korehani.com', 'http://localhost:8765'].includes(origin)
  cors = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}) }
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors } })

async function claude(sb: any, apiKey: string, feature: string, prompt: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 125_000)
  let r: Response
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    })
  } finally { clearTimeout(t) }
  if (!r.ok) {
    const e = await r.json().catch(() => null)
    throw new Error(`Anthropic ${r.status}${e?.error?.message ? ': ' + String(e.error.message).slice(0, 160) : ''}`)
  }
  const d = await r.json()
  const u = d.usage || {}
  sb.from('claude_api_usage').insert({ user_id: null, feature: 'cron:' + feature, model: MODEL, input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 }).then(() => {}, () => {})
  return (d.content || []).map((c: any) => c.text || '').join('')
}
function parseJson(text: string): any {
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e < s) throw new Error('no JSON in reply')
  return JSON.parse(text.slice(s, e + 1))
}

function blockText(b: Block) {
  return `Q${b.from}${b.to > b.from ? '–' + b.to : ''} — type ${b.type}${b.set ? ` (one shared ${b.type.startsWith('l_') ? 'script' : 'passage'} for ${b.set} questions)` : b.to > b.from ? ' (each number is a separate item)' : ''}\n  Instruction on the paper: ${b.ko}\n  Write: ${b.make}`
}

function genPrompt(level: 'I' | 'II', section: string, listening: boolean, chunk: Block[], avoid: string[], retryNote: string) {
  return `You write ORIGINAL practice questions in the TOPIK format for KoreHani, a Korean-learning site. Never copy or closely paraphrase real TOPIK past papers — invent new situations, names and numbers.
${LEVEL_GUIDE[level]}
Section: TOPIK ${level} ${listening ? 'LISTENING (learners only hear the script; they read the question and choices)' : 'READING'}.

Write exactly these question numbers, in the official layout:
${chunk.map(blockText).join('\n')}

Rules:
- Korean must be natural — what a native teacher would write in a real exam. Correct spacing and spelling.
- Exactly ONE choice is correct. Every wrong choice must be clearly wrong for a careful reader${listening ? '/listener' : ''} (contradicts the text, wrong grammar in the slot, or not supported) — never "also possible".
- Choices are similar in length and style; no "all of the above"; the correct answer must not be guessable without the ${listening ? 'script' : 'text'}.
- ${listening ? 'Scripts: an array of lines {"s":"남자"|"여자","t":"…"}; one-speaker items use one line. Spoken style, realistic length. Never put the answer in the question.' : 'Passages: use line breaks (\\n) for notices, emails and (가)(나)(다)(라) lists. Mark underlined text as [u]…[/u].'}
- "kind" for each question is one of: ${KINDS.join(', ')}.
- "explanation": one short English sentence saying why the answer is right (quote the key Korean).
- "topic": 2–4 English words.
- Do not reuse these recent topics: ${avoid.slice(0, 80).join('; ') || '(none)'}
${retryNote}
Return ONLY JSON:
{"sets":[{"from":n,"to":n,"topic":"…","passage":${listening ? 'null' : '"…"'},"script":${listening ? '[{"s":"남자","t":"…"}]' : 'null'},"media":null,"questions":[{"n":n,"kind":"…","question":"the printed question for set items, else null","choices":["…","…","…","…"],"answer":1,"explanation":"…"}]}]}
Single items get one set each (from = to = n). Graph choices are objects {"graph":{"title":"…","unit":"%","items":[{"label":"…","value":12}]}}; a reading graph goes in "media" as {"graph":{…}}.`
}

function checkPrompt(level: string, listening: boolean, sets: any[]) {
  const lines: string[] = []
  for (const s of sets) {
    const mat = listening ? (s.script || []).map((l: any) => `${l.s}: ${l.t}`).join(' / ') : String(s.passage || '').replace(/\n/g, ' / ')
    lines.push(`=== ${listening ? 'SCRIPT' : 'TEXT'} for Q${s.from}${s.to > s.from ? '–' + s.to : ''}: ${mat}${s.media?.graph ? ' | GRAPH: ' + JSON.stringify(s.media.graph) : ''}`)
    for (const q of s.questions || []) {
      lines.push(`Q${q.n} [${q.instruction || ''}] ${q.question || ''} | ${(q.choices || []).map((c: any, i: number) => `${i + 1}) ${typeof c === 'string' ? c : JSON.stringify(c)}`).join('  ')}`)
    }
  }
  return `You are a strict TOPIK ${level} examiner reviewing NEW practice questions before they are published. For each question, read only the material and answer it yourself — choose the single best option. Then judge quality.
Set "ok": false if ANY of these is true: more than one choice could be defended as correct; no choice is clearly correct; the question cannot be answered from the ${listening ? 'script' : 'text'}; the Korean is unnatural or has errors; the item does not match its instruction; the difficulty is far off for TOPIK ${level}.
Return ONLY JSON: {"checks":[{"n":<number>,"pick":<1-4>,"ok":true|false,"issue":"short English, empty if ok"}]}

${lines.join('\n')}`
}

// Shuffle text choices so answers are spread evenly (insert ㉠–㉣ keep order).
function shuffleChoices(q: any, fixed: boolean) {
  if (fixed) return
  const idx = [0, 1, 2, 3]
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  const ch = idx.map((i) => q.choices[i])
  q.answer = idx.indexOf(q.answer - 1) + 1
  q.choices = ch
}

function validate(chunk: Block[], data: any): any[] {
  const want = new Set<number>()
  for (const b of chunk) for (let n = b.from; n <= b.to; n++) want.add(n)
  const sets = Array.isArray(data?.sets) ? data.sets : []
  const got = new Set<number>()
  for (const s of sets) {
    for (const q of s.questions || []) {
      if (!want.has(q.n)) throw new Error('unexpected question ' + q.n)
      if (!Array.isArray(q.choices) || q.choices.length !== 4) throw new Error('Q' + q.n + ' needs 4 choices')
      if (!(q.answer >= 1 && q.answer <= 4)) throw new Error('Q' + q.n + ' bad answer')
      got.add(q.n)
    }
  }
  for (const n of want) if (!got.has(n)) throw new Error('missing Q' + n)
  return sets
}

function blockFor(chunk: Block[], n: number) { return chunk.find((b) => n >= b.from && n <= b.to)! }

async function step(sb: any, apiKey: string, job: any): Promise<string> {
  const spec = SPEC[sectionKey(job.level, job.section)]
  const p = job.progress || {}
  p.chunk = p.chunk || 0
  p.items = p.items || []
  p.tries = p.tries || 0
  const chunks = spec.chunks

  // 1) Generate / check chunks
  if (p.chunk < chunks.length) {
    const chunk = chunks[p.chunk]
    if (!p.pending) {
      if (!p.avoid) {
        const { data } = await sb.from('topik_items').select('topic').not('topic', 'is', null)
          .like('test_id', (job.level === 'I' ? 'i' : 'ii') + '-' + job.section[0] + '-%').order('created_at', { ascending: false }).limit(150)
        p.avoid = Array.from(new Set((data || []).map((r: any) => r.topic))).slice(0, 80)
      }
      const used = p.items.map((i: any) => i.topic).filter(Boolean)
      const note = p.retryIssues ? `This is a rewrite. The previous version had these problems — fix them: ${p.retryIssues}` : ''
      const text = await claude(sb, apiKey, 'topik-gen', genPrompt(job.level, job.section, spec.listening, chunk, [...used, ...p.avoid], note), 7000)
      const sets = validate(chunk, parseJson(text))
      for (const s of sets) for (const q of s.questions) q.instruction = blockFor(chunk, q.n).ko
      p.pending = sets
      job.progress = p
      return `generated chunk ${p.chunk + 1}/${chunks.length}`
    }
    const sets = p.pending
    const res = parseJson(await claude(sb, apiKey, 'topik-check', checkPrompt(job.level, spec.listening, sets), 2500))
    const byN: Record<number, any> = {}
    for (const c of res.checks || []) byN[c.n] = c
    const bad: string[] = []
    for (const s of sets) for (const q of s.questions) {
      const c = byN[q.n]
      q._ok = !!c && c.ok !== false && Number(c.pick) === Number(q.answer)
      if (!q._ok) bad.push(`Q${q.n}: ${c ? (c.issue || `blind answer ${c.pick} ≠ key ${q.answer}`) : 'not checked'}`)
    }
    if (bad.length && p.tries + 1 < MAX_TRIES) {
      p.tries++; p.retryIssues = bad.join(' | '); p.pending = null
      job.progress = p
      return `chunk ${p.chunk + 1}: ${bad.length} failed, rewriting`
    }
    for (const s of sets) {
      const b = blockFor(chunk, s.questions[0].n)
      const gkey = (s.questions.length > 1) ? `g${s.from}` : null
      for (const q of s.questions) {
        shuffleChoices(q, b.choices === 'insert')
        p.items.push({
          n: q.n, type: b.set ? (KINDS.includes(q.kind) ? q.kind : b.type) : b.type, group_key: gkey,
          passage: s.passage || null, script: s.script || null, media: s.media || null,
          question: q.question || null, instruction: q.instruction, choices: q.choices, answer: q.answer,
          explanation: q.explanation || null, topic: s.topic || null, qa_flag: q._ok ? null : (bad.find((x) => x.startsWith('Q' + q.n + ':')) || 'check failed').slice(0, 300),
        })
      }
    }
    p.chunk++; p.tries = 0; p.pending = null; p.retryIssues = null
    job.progress = p
    return `chunk ${p.chunk}/${chunks.length} accepted${bad.length ? ` (${bad.length} flagged)` : ''}`
  }

  // 2) Save the test
  if (!job.test_id) {
    const pre = (job.level === 'I' ? 'i' : 'ii') + '-' + job.section[0]
    const { data: existing } = await sb.from('topik_tests').select('id,number').eq('level', job.level).eq('section', job.section).eq('kind', 'full')
    const number = Math.max(0, ...(existing || []).map((t: any) => t.number || 0)) + 1
    const id = `${pre}-${number}`
    const flagged = p.items.filter((i: any) => i.qa_flag).length
    const title = `TOPIK ${job.level} · ${job.section === 'reading' ? 'Reading' : 'Listening'} · Test ${number}`
    const { error: te } = await sb.from('topik_tests').insert({
      id, level: job.level, section: job.section, kind: 'full', title, minutes: spec.minutes, free: !(existing || []).length,
      sort: (job.level === 'I' ? 100 : 300) + (job.section === 'reading' ? 0 : 100) + number, status: flagged ? 'draft' : 'published',
      number, source: 'gen', flagged,
    })
    if (te) throw new Error('save test: ' + te.message)
    const rows = p.items.sort((a: any, b: any) => a.n - b.n).map((i: any) => ({
      id: `${id}-${i.n}`, test_id: id, n: i.n, type: i.type, group_key: i.group_key ? `${id}-${i.group_key}` : null,
      passage: i.passage, script: i.script, media: i.media, question: i.question, instruction: i.instruction,
      choices: i.choices, answer: i.answer, explanation: i.explanation, topic: i.topic, qa_flag: i.qa_flag,
      qa_at: new Date().toISOString(),
    }))
    const { error: ie } = await sb.from('topik_items').insert(rows)
    if (ie) { await sb.from('topik_tests').delete().eq('id', id); throw new Error('save items: ' + ie.message) }
    job.test_id = id
    p.items = []          // saved — keep the job row small
    p.audio_done = !spec.listening
    job.progress = p
    return `saved ${id}${flagged ? ` as draft (${flagged} flagged)` : ''} (${questionCount(spec)} questions)`
  }

  // 3) Listening audio (needs Azure; otherwise the page uses the device voice)
  if (!p.audio_done) {
    const key = Deno.env.get('AZURE_SPEECH_KEY'), region = Deno.env.get('AZURE_SPEECH_REGION')
    if (!key || !region) { p.audio_done = true; p.audio_skipped = true; job.progress = p; return 'audio skipped (Azure not configured)' }
    const { data: items } = await sb.from('topik_items').select('id,group_key,script').eq('test_id', job.test_id).is('audio_url', null).order('n').limit(40)
    if (!items || !items.length) { p.audio_done = true; job.progress = p; return 'audio done' }
    const started = Date.now()
    const doneGroups: Record<string, string> = {}
    let made = 0
    for (const it of items) {
      if (Date.now() - started > 90_000) break
      if (it.group_key && doneGroups[it.group_key]) { await sb.from('topik_items').update({ audio_url: doneGroups[it.group_key] }).eq('id', it.id); continue }
      const url = await synthScript(sb, it.script || [], key, region, `topik/${job.test_id}/${it.id}.mp3`)
      if (it.group_key) { doneGroups[it.group_key] = url; await sb.from('topik_items').update({ audio_url: url }).eq('group_key', it.group_key) }
      else await sb.from('topik_items').update({ audio_url: url }).eq('id', it.id)
      made++
    }
    job.progress = p
    return `audio: ${made} clips`
  }
  return 'complete'
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
async function synthScript(sb: any, script: any[], key: string, region: string, path: string): Promise<string> {
  const voice = (s: string) => /남/.test(s) ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural'
  const body = script.map((l) => `<voice name="${voice(String(l.s || ''))}">${esc(String(l.t || ''))}<break time="600ms"/></voice>`).join('')
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">${body}</speak>`
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'korehani-topik' },
    body: ssml,
  })
  if (!r.ok) throw new Error('azure ' + r.status)
  const audio = new Uint8Array(await r.arrayBuffer())
  const up = await sb.storage.from('tts-cache').upload(path, audio, { contentType: 'audio/mpeg', upsert: true })
  if (up.error) throw new Error('upload: ' + up.error.message)
  return sb.storage.from('tts-cache').getPublicUrl(path).data.publicUrl
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(url, service)
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  let trusted = (token && token === service) || (cronSecret.length >= 32 && token === cronSecret)
  if (!trusted) {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: 'Bearer ' + token, apikey: Deno.env.get('SUPABASE_ANON_KEY') || service } })
    const u = r.ok ? await r.json() : null
    if (u?.email !== ADMIN_EMAIL) return json({ ok: false, error: 'unauthorized' }, 401)
    trusted = true
  }
  const body = await req.json().catch(() => ({}))

  if (body.action === 'enqueue') {
    const level = body.level === 'II' ? 'II' : 'I'
    const section = body.section === 'listening' ? 'listening' : 'reading'
    const count = Math.max(1, Math.min(20, Number(body.count) || 1))
    const rows = Array.from({ length: count }, () => ({ level, section }))
    const { error } = await sb.from('topik_gen_jobs').insert(rows)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, queued: count })
  }

  if (body.action === 'tick') {
    // Re-queue a crashed step, then claim the oldest waiting job.
    await sb.from('topik_gen_jobs').update({ status: 'pending' }).eq('status', 'running').lt('started_at', new Date(Date.now() - 4 * 60_000).toISOString())
    const { data: next } = await sb.from('topik_gen_jobs').select('id').eq('status', 'pending').order('created_at').limit(1).maybeSingle()
    if (!next) return json({ ok: true, idle: true })
    const { data: job } = await sb.from('topik_gen_jobs').update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', next.id).eq('status', 'pending').select('*').maybeSingle()
    if (!job) return json({ ok: true, raced: true })
    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').maybeSingle()
    try {
      if (!setting?.value) throw new Error('No Anthropic API key in app_settings')
      const msg = await step(sb, setting.value, job)
      const p = job.progress || {}
      const finished = !!job.test_id && p.audio_done
      await sb.from('topik_gen_jobs').update({
        status: finished ? 'done' : 'pending', progress: p, test_id: job.test_id || null, error: null,
        ticks: (job.ticks || 0) + 1, updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return json({ ok: true, job: job.id, step: msg })
    } catch (e) {
      const msg = String((e as Error)?.message || e).slice(0, 300)
      const ticks = (job.ticks || 0) + 1
      await sb.from('topik_gen_jobs').update({
        status: ticks > 90 ? 'failed' : 'pending', error: msg, ticks, progress: job.progress, updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return json({ ok: false, job: job.id, error: msg })
    }
  }
  return json({ ok: false, error: 'unknown_action' }, 400)
})
