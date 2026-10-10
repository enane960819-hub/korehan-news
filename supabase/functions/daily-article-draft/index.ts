// Daily Article Draft — automates the admin "headline → body → analysis"
// pipeline up to (but NOT including) publish.
//
// Flow (one pg_cron tick every 5 min, 06:00–06:55 KST):
//   tick 1   : fetch headlines (Cloudflare /api/admin-source-fetch), drop
//              ones already in `articles`, ask Haiku to pick 4 (one per
//              level) + assign a section → queue in app_settings.
//   tick 2-n : take the next queued pick and build ONE draft:
//              Sonnet body → save article (status='draft') → Haiku
//              sentence analysis → Haiku quiz → article_cache rows.
//   later    : queue empty → no-op (cheap).
// One article per invocation keeps every run well under the Edge
// Function wall-clock limit.
//
// The admin reviews drafts in the CMS (🤖 banner on the dashboard) and
// publishes. Sentence analysis is already cached, so readers never see
// "Analysis in progress".
//
// Prompts are ports of runAutoGenerate / runPendingAnalysisAll in
// korehan-x9f4k2m7.html — keep them in sync when either changes.
//
// Auth: service_role bearer, CRON_SECRET bearer (>=32 chars), or the
// admin user's JWT. POST body (all optional):
//   { "force": true }   rebuild today's queue even if one exists
//   { "dry_run": true } fetch + pick only, don't write articles

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const SITE_URL = Deno.env.get('SITE_URL') || 'https://korehani.com'
const QUEUE_KEY = 'daily_article_draft_queue'
const LOCK_KEY = 'daily_article_draft_lock'
const LOCK_TTL_MS = 4 * 60 * 1000
const MAX_ATTEMPTS = 2
const SENT_CACHE_VERSION = 's6' // = SENT_CACHE_CURRENT in the admin CMS

const MODEL_BODY = 'claude-sonnet-4-6'
const MODEL_FAST = 'claude-haiku-4-5-20251001'

const LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced'] as const
type Level = typeof LEVELS[number]

// Mirrors CATEGORIES in korehan-x9f4k2m7.html.
const SECTIONS: Array<{ key: string; topics: string }> = [
  { key: '사회', topics: 'Korean society, education, housing, labor, welfare, demographics' },
  { key: '국제', topics: 'international affairs, geopolitics, diplomacy, global economy' },
  { key: '문화', topics: 'culture, arts, museums, literature, lifestyle' },
  { key: '연예', topics: 'Korean celebrities, K-drama, movies, variety shows' },
  { key: '해외연예', topics: 'Hollywood, international actors, global music, award shows' },
  { key: 'crime', topics: 'true crime, investigations, court trials' },
  { key: 'K-pop', topics: 'idols, comebacks, charts, fan culture, concerts' },
  { key: 'IT과학', topics: 'technology, AI, EVs, space, robotics, science' },
  { key: 'nature', topics: 'wildlife, animals, ecosystems, climate, environment' },
  { key: '역사', topics: 'historical events, archaeology, war history' },
  { key: 'Korea', topics: 'Korean Wave, tourism, Korean food and lifestyle' },
  { key: 'beauty', topics: 'beauty, skincare, wellness, self-care' },
  { key: 'travel', topics: 'travel destinations, tourism, travel tips' },
  { key: '오피니언', topics: 'social commentary, editorial' },
]

const LEVEL_INFO: Record<Level, { ko: string; vocab: string; tone: string; label: string }> = {
  Starter: {
    ko: '입문 (초등 1~2학년 수준)', vocab: '기초 낱말, 아주 짧은 문장', label: 'Seed',
    tone: 'Seed (Pre-TOPIK 입문): **해요체만 (~예요/~이에요/~어요/~았어요/~었어요)**. 합쇼체(~ㅂ니다/~습니다) X. 평어체(~다/~한다) 절대 X. 단순 SVO. 패턴 stack 금지. 어휘는 TOPIK 1 입문 수준만.',
  },
  Beginner: {
    ko: '초급 (TOPIK 1~2급)', vocab: '쉬운 일상 어휘, ~해요/~이에요 체', label: 'Sprout',
    tone: 'Sprout (TOPIK 1~2): **해요체 또는 합쇼체 — 한 기사 안에서는 일관되게**. ~고, ~지만, ~기 전에/후에, ~려고 하다. ~기 위해 / ~게 되다 / 사역 / 피동 금지. 평어체(~다/~한다) 절대 X.',
  },
  Intermediate: {
    ko: '중급 (TOPIK 3~4급)', vocab: '일반 뉴스 어휘, 중간 난이도 문장', label: 'Tree',
    tone: 'Tree (TOPIK 3~4): **합쇼체 (~ㅂ니다/~습니다) 우선**. 본문 전체를 ~았/었습니다만으로 채우지 마세요. 한 기사에 최소 4개 이상 자연스럽게: ~기 위해, ~게 되었습니다, ~다고 합니다, ~(으)면서, ~ㄴ/은/는 것 같습니다, ~ㄹ/을 텐데, 불규칙 활용, ~기 때문입니다, ~려고 합니다, ~ㄴ/은 후에. 평어체 절대 X.',
  },
  Advanced: {
    ko: '고급 (TOPIK 5~6급)', vocab: '고급 한자어, 복잡한 문장 구조', label: 'Forest',
    tone: 'Forest (TOPIK 5~6): **합쇼체 정중체 위주**. 필수 노출: ~기에 이르렀습니다, ~는 데 그쳤습니다, ~을 비롯한, ~로 인하여, ~기 마련입니다, 사역, 피동, ~(으)ㄴ/는 만큼, ~기는커녕, ~에 대하여, ~ㄴ/는다고 합니다. TOPIK 5~6 한자어 활용. 평어체 절대 X.',
  },
}

type Headline = {
  title: string; url: string; source?: string; desc?: string; summary?: string
  image?: string; published_at?: string; category?: string
}
type DraftPick = {
  headline: Headline; level: Level; section: string
  status: 'pending' | 'done' | 'failed'; attempts: number
  article_id?: string; title_ko?: string; error?: string
}
type Queue = { date: string; created_at: string; picks: DraftPick[] }

// ── helpers ───────────────────────────────────────────────────
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}
function headlineKey(title = ''): string {
  return String(title).toLowerCase().replace(/[^\w가-힣]+/g, '').slice(0, 140)
}
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
// CORS so the admin CMS "▶ Build next draft now" button can call us.
let corsHeaders: Record<string, string> = {}
function setCors(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ['https://korehani.com', 'https://www.korehani.com', 'https://korehannews.com', 'https://www.korehannews.com', 'http://localhost:3000', 'http://localhost:8888']
  corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

function extractJsonObject(raw: string): any {
  let clean = String(raw || '').replace(/```json?/g, '').replace(/```/g, '').trim()
  const s = clean.indexOf('{')
  if (s < 0) throw new Error('No JSON object in response')
  let depth = 0, inStr = false, esc = false, e = -1
  for (let i = s; i < clean.length; i++) {
    const ch = clean[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { e = i; break } }
  }
  // e < 0 → truncated mid-object: keep the whole tail so the salvage
  // below can close it after the last complete array item.
  clean = e < 0 ? clean.slice(s) : clean.slice(s, e + 1)
  try { return JSON.parse(clean) } catch (_) { /* repair below */ }
  const repaired = clean.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f]+/g, ' ')
  try { return JSON.parse(repaired) } catch (_) { /* truncation salvage below */ }
  // Truncated array of objects ({"sentences":[{..},{..},{..) → keep complete items.
  let cut = repaired.lastIndexOf('},')
  while (cut > 0) {
    try { return JSON.parse(repaired.slice(0, cut + 1) + ']}') } catch (_) { cut = repaired.lastIndexOf('},', cut - 1) }
  }
  throw new Error('JSON parse failed after repair')
}

async function callClaude(
  sb: any, apiKey: string, feature: string, model: string, maxTokens: number,
  content: string | Array<Record<string, unknown>>, timeoutMs = 110_000,
): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    })
  } finally { clearTimeout(t) }
  if (!resp.ok) {
    // Surface Anthropic's own message — e.g. "Your credit balance is too
    // low to access the Anthropic API" — so the admin sees the real cause.
    const errBody = await resp.json().catch(() => null)
    const detail = errBody?.error?.message ? ': ' + String(errBody.error.message).slice(0, 200) : ''
    throw new Error(`Anthropic ${resp.status} (${feature})${detail}`)
  }
  const data = await resp.json()
  // Same telemetry table claude-proxy writes, so the cost dashboard sees cron spend.
  const u = data.usage || {}
  sb.from('claude_api_usage').insert({
    user_id: null, feature: 'cron:' + feature, model,
    input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    output_tokens: u.output_tokens || 0,
  }).then(() => {}, () => {})
  return (data.content || []).map((c: { text?: string }) => c.text || '').join('')
}

// ── step 1: headlines + AI pick ───────────────────────────────
async function fetchMetaDescription(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (!r.ok || !/text\/html/.test(r.headers.get('content-type') || '')) return ''
    const head = (await r.text()).slice(0, 60_000)
    const m = head.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]*content=["']([^"']{20,})["']/i)
      || head.match(/<meta[^>]+content=["']([^"']{20,})["'][^>]*(?:property|name)=["'](?:og:description|description|twitter:description)["']/i)
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 400) : ''
  } catch (_) { return '' }
}

async function buildQueue(sb: any, apiKey: string): Promise<Queue> {
  // Dedupe set: everything already in articles (drafts included).
  // Explicit columns keep this light; fall back if a column is missing
  // in the live schema (source_url / title_en have drifted before).
  let { data: existing, error: exErr } = await sb.from('articles').select('title,title_en,source_url').order('date', { ascending: false }).limit(1500)
  if (exErr) ({ data: existing } = await sb.from('articles').select('title').order('date', { ascending: false }).limit(1500))
  const seen = new Set<string>()
  ;(existing || []).forEach((r: any) => {
    if (r?.title) seen.add(headlineKey(r.title))
    if (r?.title_en) seen.add(headlineKey(r.title_en))
    if (r?.source_url) seen.add(String(r.source_url).trim())
  })

  const resp = await fetch(`${SITE_URL}/api/admin-source-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_ids: [], limit: 100 }),
    signal: AbortSignal.timeout(32_000),
  })
  if (!resp.ok) throw new Error('source fetch HTTP ' + resp.status)
  const payload = await resp.json().catch(() => ({}))
  const raw: Headline[] = Array.isArray(payload?.items) ? payload.items : []

  const threeDays = 3 * 86400_000
  const fresh = raw.filter((h) => {
    if (!h?.title || !h?.url) return false
    if (seen.has(String(h.url).trim()) || seen.has(headlineKey(h.title))) return false
    const t = h.published_at ? new Date(h.published_at).getTime() : Date.now()
    return Number.isNaN(t) || Date.now() - t <= threeDays
  })
  // Thin sources make the body prompt pad with filler — require a real
  // summary. Reddit / HN / Google-News items often have none (or just the
  // title echoed back), so try the target page's og:description first.
  const summaryOf = (h: Headline) => {
    const s = String(h.desc || h.summary || '').replace(/\s+/g, ' ').trim()
    return headlineKey(s).startsWith(headlineKey(h.title).slice(0, 40)) && s.length < h.title.length + 40 ? '' : s
  }
  const needs = fresh.filter((h) => summaryOf(h).length < 40 && !/news\.google\.com/.test(h.url)).slice(0, 30)
  for (let i = 0; i < needs.length; i += 8) {
    await Promise.all(needs.slice(i, i + 8).map(async (h) => {
      const d = await fetchMetaDescription(h.url)
      if (d) h.summary = d
    }))
  }
  const candidates = fresh.filter((h) => summaryOf(h).length >= 40).slice(0, 60)
  const stats = `raw=${raw.length} fresh=${fresh.length} enriched_tried=${needs.length} with_summary=${candidates.length}`
  console.log('[daily-article-draft] headlines', stats)
  if (candidates.length < 4) throw new Error(`only ${candidates.length} usable headlines (${stats})`)

  const list = candidates.map((h, i) =>
    `${i}. [${h.source || ''}]${h.image ? ' [img]' : ''} ${h.title}\n   ${String(h.desc || h.summary || '').replace(/\s+/g, ' ').slice(0, 220)}`
  ).join('\n')
  const selectPrompt =
    'You pick today\'s news stories for a Korean-learning site for foreign learners. Each story will be rewritten in Korean at one TOPIK level.\n\n'
    + 'Candidates:\n' + list + '\n\n'
    + 'Pick EXACTLY 4 different stories — one for each level: Starter (absolute beginner), Beginner (TOPIK 1-2), Intermediate (TOPIK 3-4), Advanced (TOPIK 5-6).\n'
    + 'Criteria, in order:\n'
    + '1. Substance: the summary has enough concrete facts to write 4+ paragraphs WITHOUT inventing anything.\n'
    + '2. Learner interest: surprising, useful, warm or culturally interesting; Korea-related stories are a plus.\n'
    + '3. Level fit: Starter/Beginner get simple concrete topics (animals, food, daily life, light culture). Heavier topics (politics, economy, conflict) only for Intermediate/Advanced.\n'
    + '4. Avoid: graphic violence, death tolls, sexual content, partisan politics framing, celebrity gossip without facts, pure listicles/ads.\n'
    + '5. Variety: 4 different sections. Prefer [img] stories.\n\n'
    + 'Sections (use the exact key): ' + SECTIONS.map((s) => `${s.key} (${s.topics})`).join('; ') + '\n\n'
    + 'Return ONLY JSON: {"picks":[{"idx":<number>,"level":"Starter|Beginner|Intermediate|Advanced","section":"<key>"}]}'
  const out = extractJsonObject(await callClaude(sb, apiKey, 'daily-draft-select', MODEL_FAST, 600, selectPrompt, 45_000))

  const sectionKeys = new Set(SECTIONS.map((s) => s.key))
  const usedIdx = new Set<number>(), usedLvl = new Set<string>()
  const picks: DraftPick[] = []
  for (const p of (out?.picks || [])) {
    const idx = Number(p?.idx), lvl = String(p?.level || '') as Level
    if (!candidates[idx] || usedIdx.has(idx) || !LEVELS.includes(lvl) || usedLvl.has(lvl)) continue
    usedIdx.add(idx); usedLvl.add(lvl)
    picks.push({
      headline: candidates[idx], level: lvl,
      section: sectionKeys.has(p?.section) ? p.section : (candidates[idx].category && sectionKeys.has(candidates[idx].category!) ? candidates[idx].category! : '문화'),
      status: 'pending', attempts: 0,
    })
  }
  // Fill any level the model skipped with the next unused candidate.
  for (const lvl of LEVELS) {
    if (usedLvl.has(lvl)) continue
    const idx = candidates.findIndex((_, i) => !usedIdx.has(i))
    if (idx < 0) break
    usedIdx.add(idx); usedLvl.add(lvl)
    const cat = candidates[idx].category
    picks.push({ headline: candidates[idx], level: lvl, section: cat && sectionKeys.has(cat) ? cat : '문화', status: 'pending', attempts: 0 })
  }
  return { date: kstToday(), created_at: new Date().toISOString(), picks }
}

// ── step 2: one draft ─────────────────────────────────────────
function bodyPrompt(h: Headline, level: Level, section: string): string {
  const L = LEVEL_INFO[level]
  const today = new Date(Date.now() + 9 * 3600_000)
  const todayKo = `${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`
  return '당신은 외국인 한국어 학습자를 위한 뉴스 기사 편집자입니다.\n\n'
    + '[원본 뉴스]\n제목: ' + h.title + '\n내용: ' + (h.desc || h.summary || '(요약 없음)') + '\n출처: ' + (h.source || '') + '\n\n'
    + '[지시사항]\n'
    + '- 원본의 핵심 사실과 주제 유지. 영어 출처면 한국어로 번역·각색.\n'
    + '- 독자는 한국어를 배우는 외국인 학습자. 어휘/문법 난이도는 레벨에 맞추되 본문은 일반 한국어 뉴스처럼 자연스럽게.\n'
    + '- ★ 환각 금지 ★ 원본 텍스트에 명시된 것만 사용:\n'
    + '    a. 원본에 없는 사실/숫자/통계/발언/날짜/장소 추가 금지\n'
    + '    b. 사진/영상 묘사 금지 (당신은 사진을 못 봄)\n'
    + '    c. 편집자 감상/감정/해석 금지 ("정말 특별해요", "마음이 따뜻해져요")\n'
    + '    d. 원본에 없는 인과관계 추측 금지\n'
    + '    e. 상식 설명 금지 ("1921년은 약 100년 전이다", "바르샤바는 폴란드의 도시이다", "BTS는 한국의 아이돌 그룹이다")\n'
    + '- 분량: 원본 길이에 맞춰 4~8단락, 단락당 2~4문장. 원본이 짧으면 짧게. 채우려고 사족 금지. 마지막 단락은 자연스러운 마무리 문장 (중간 cut 금지).\n'
    + '- 클리셰 마무리 금지 ("전문가들은 ~", "귀추가 주목됩니다", "사회적 관심을 모으고 있어요").\n\n'
    + '[섹션: ' + section + ']\n[난이도: ' + L.ko + ']\n[어휘 수준: ' + L.vocab + ']\n[오늘 날짜: ' + todayKo + ']\n\n'
    + '[문체]\n- 짧고 명확한 문장 (20~35자)\n- 본문 톤: ' + L.tone + '\n'
    + '- 괄호 보충 설명 금지 ("인공지능(AI)" X). 한자 절대 금지.\n- 제목: 15~25자\n\n'
    + '[한국어 문법 규칙]\n'
    + '1. 3인칭 주어 + 심리형용사는 "-아/어 하다" (✓아이들은 만들고 싶어 합니다 ✗만들고 싶습니다; 슬퍼하다, 기뻐하다, 무서워하다, 좋아하다).\n'
    + '2. 한 절 안에서 같은 지시 대상의 은/는 ↔ 이/가 섞지 말 것.\n'
    + '3. 같은 절의 시제 일치.\n'
    + '4. 보조용언 띄어쓰기 (✓가고 싶다 / 먹어 보다 / 읽고 있다).\n\n'
    + '[중요표현] 본문에 등장한 고정 표현 0~3개 (관용구, 사자성어, 굳어진 표현). 없으면 [].\n'
    + '[단락별 번역] body의 각 단락(\\n\\n 구분)마다 polished English 1줄, 개수 동일.\n\n'
    + '[출력 — JSON ONLY, no preamble, no code fences]\n'
    + '{"title":"<Korean title>","title_en":"<English headline ≤70 chars>","body":"본문 (단락 \\\\n\\\\n)","key_expressions":[{"ko":"...","en":"..."}],"paragraph_translations":["..."]}'
}

function analysisPrompt(title: string, body: string, level: Level): string {
  const low = level === 'Starter' || level === 'Beginner'
  return '당신은 한국어 학습자를 위한 문장 단위 분석가입니다. 아래 한국어 기사 본문에 대해 문장별로 vocab + 문법/표현 분석을 생성해 주세요.\n\n'
    + '[기사 제목]\n' + title + '\n\n[기사 본문 (단락 \\n\\n 구분)]\n' + body + '\n\n'
    + '[학습자 레벨]\n' + LEVEL_INFO[level].label + ' (' + level + ')\n\n'
    + '[문장별 분석]\n'
    + '- 본문에 등장하는 모든 한국어 문장을 등장 순서대로 추출.\n'
    + '- text: 본문에 EXACTLY 등장한 형태 그대로 (마침표/물음표 포함).\n'
    + '- translation: 폴리시된 영어 번역 (같은 주어, 같은 시제, 같은 격식). 한국어에 없는 I/we 주어 추가 금지.\n'
    + '- vocab: max 4. 사전형으로 (✓잡다 ✗잡았어요). ' + (low ? '입문/초급 단어도 포함 OK.' : '입문 단어(는/이/가/이다/있다/하다/되다)는 스킵.') + ' 빈 배열 OK.\n'
    + '- analysis: ' + (low ? 'max 6 items.' : 'max 4 items.') + ' 각 항목:\n'
    + '    type: "grammar" | "expression" | "idiom"\n'
    + '    label: 패턴/표현 자체 (canonical, 예: "~았/었어요"). grammar는 형태소/연결어미/활용 종류만. 명사 X.\n'
    + '    exp: 1-2줄 영어 설명. morpheme이 무엇을 하는지 + 사전형 → 활용형 chain.\n'
    + '    example_in_sentence: 이 문장의 literal substring chunk.\n'
    + '- 본문에 없는 패턴 절대 금지. 확실하지 않으면 생략.\n'
    + '- expression/idiom은 그 문장 의미에 핵심일 때만.\n\n'
    + '[출력 — JSON ONLY, no preamble, no code fences]\n'
    + '{"sentences":[{"text":"<exact KO sentence>","translation":"<EN>","vocab":[{"ko":"...","en":"..."}],"analysis":[{"type":"grammar","label":"...","exp":"...","example_in_sentence":"..."}]}]}'
}

// Same splitter as _khSplitSentencesForCache (admin) / _khWrapSentences (reader).
function splitSentences(body: string): string[] {
  const out: string[] = []
  String(body || '').split(/\n\n+/).forEach((para) => {
    para.split(/\n+/).forEach((piece) => {
      const trimmed = piece.trim()
      if (!trimmed) return
      trimmed.replace(/([.!?。])\s+/g, '$1\u0001').split('\u0001').forEach((s) => {
        const st = s.trim()
        if (st) out.push(st)
      })
    })
  })
  return out
}

function canonGrammarKey(label: string): string {
  let s = String(label || '').trim()
  s = s.replace(/\s*\([^)]*[a-zA-Z][^)]*\)\s*$/, '').trim()
  s = s.replace(/\(서\)$/, '').replace(/서$/, '').trim()
  return s.replace(/\s+/g, ' ').toLowerCase()
}

// Port of _khDeriveVocabGrammarFromSentences (admin) — Vocab + Grammar tabs.
function deriveTabs(sentences: any[], level: Level) {
  const vocabSeen: Record<string, true> = {}
  const vocab: any[] = []
  const byKey: Record<string, any> = {}
  const grammar: any[] = []
  for (const s of sentences) {
    for (const v of (s.vocab || [])) {
      const ko = String(v?.ko || '').trim()
      if (!ko || vocabSeen[ko]) continue
      vocabSeen[ko] = true
      vocab.push({ ko, en: String(v.en || '').trim(), note: String(v.note || '').trim() })
    }
    for (const a of (s.analysis || [])) {
      if (!a || (a.type || 'grammar') !== 'grammar') continue
      const name = String(a.label || '').trim()
      const key = canonGrammarKey(name)
      if (!key) continue
      const exp = String(a.exp || '').trim()
      if (byKey[key]) {
        if (name.length > byKey[key].name.length) byKey[key].name = name
        if (exp.length > (byKey[key].exp || '').length) byKey[key].exp = exp
        continue
      }
      byKey[key] = { name, level, exp, ex_ko: s.text, ex_en: s.translation || '' }
      grammar.push(byKey[key])
    }
  }
  return { vocab: vocab.slice(0, 100), grammar: { patterns: grammar.slice(0, 15) } }
}

async function persistImage(sb: any, url: string, articleId: string): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url) || /\.supabase\.co\/storage\//.test(url)) return url || ''
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]
    if (!/^image\//.test(ct)) throw new Error('not an image: ' + ct)
    const buf = new Uint8Array(await r.arrayBuffer())
    if (buf.byteLength < 800) throw new Error('too small')
    let ext = (ct.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
    if (ext === 'jpeg') ext = 'jpg'
    const path = `sourced/${articleId}-${Date.now()}.${ext}`
    const up = await sb.storage.from('article-images').upload(path, buf, { contentType: ct, upsert: true })
    if (up.error) throw up.error
    return sb.storage.from('article-images').getPublicUrl(path).data.publicUrl
  } catch (e) {
    console.warn('[daily-article-draft] image persist failed, keeping source URL:', (e as Error).message)
    return url
  }
}

// articles schema drifts from what the CMS sends (see CLAUDE.md incident
// 2026-05-16) — drop unknown columns one at a time, like dbSaveArticle.
async function saveArticle(sb: any, row: Record<string, unknown>) {
  const payload = { ...row }
  for (let i = 0; i < 6; i++) {
    const { error } = await sb.from('articles').upsert(payload, { onConflict: 'id' })
    if (!error) return
    const m = String(error.message || '').match(/column\s+"([^"]+)"/i) || String(error.message || '').match(/Could not find the '([^']+)' column/i)
    if (!m || !(m[1] in payload)) throw new Error('article save: ' + error.message)
    delete payload[m[1]]
  }
  throw new Error('article save: too many unknown columns')
}

async function saveCache(sb: any, articleId: string, row: Record<string, string>) {
  const wide = await sb.from('article_cache').upsert({ article_id: articleId, ...row }, { onConflict: 'article_id' })
  if (!wide.error) return
  // kv schema fallback (content_type, content_id, cache_key, cache_value)
  for (const [k, v] of Object.entries(row)) {
    if (k === 'expressions') continue
    const { error } = await sb.from('article_cache').upsert(
      { content_type: 'article', content_id: articleId, cache_key: k, cache_value: v },
      { onConflict: 'content_type,content_id,cache_key' },
    )
    if (error) throw new Error(`cache ${k}: ${error.message}`)
  }
}

async function buildDraft(sb: any, apiKey: string, pick: DraftPick): Promise<{ id: string; title: string; cacheParts: number }> {
  const h = pick.headline
  const bodyRaw = await callClaude(sb, apiKey, 'daily-draft-body', MODEL_BODY, 4000, bodyPrompt(h, pick.level, pick.section))
  const art = extractJsonObject(bodyRaw)
  if (!art?.title || !art?.body) throw new Error('invalid body JSON')

  const id = uid()
  const image = await persistImage(sb, h.image || '', id)
  const titleEn = (typeof art.title_en === 'string' && art.title_en.trim()) || (/[ㄱ-힝]/.test(h.title) ? '' : h.title)
  await saveArticle(sb, {
    id, section: pick.section, title: art.title, body: art.body, title_en: titleEn,
    date: new Date().toISOString().slice(0, 10), status: 'draft', featured: false,
    level: pick.level, source_url: h.url || '', image,
  })

  // Analysis + quiz. A failure here leaves a valid draft; the admin can
  // re-bake from AI Cache Management or the reader's ⚡ button.
  const row: Record<string, string> = {}
  let cacheParts = 0
  try {
    const aRaw = await callClaude(sb, apiKey, 'daily-draft-analysis', MODEL_FAST, 8000, analysisPrompt(art.title, art.body, pick.level))
    const aJson = extractJsonObject(aRaw)
    const rawSents: any[] = Array.isArray(aJson?.sentences) ? aJson.sentences : []
    const sentences = splitSentences(art.body).map((text, idx) => {
      let m = rawSents.find((s) => {
        const t = String(s?.text || '').trim()
        return t && (t === text || text.includes(t) || t.includes(text))
      })
      if (!m) m = rawSents[idx] || {}
      return {
        text,
        translation: typeof m.translation === 'string' ? m.translation : '',
        vocab: (Array.isArray(m.vocab) ? m.vocab : []).filter((v: any) => v && v.ko).slice(0, 4),
        analysis: (Array.isArray(m.analysis) ? m.analysis : [])
          .filter((a: any) => a && (a.label || a.pattern)).slice(0, 8)
          .map((a: any) => ({ type: a.type || 'grammar', label: a.label || a.pattern, exp: a.exp || '', example_in_sentence: a.example_in_sentence || '' })),
      }
    })
    if (sentences.some((s) => s.translation || s.vocab.length || s.analysis.length)) {
      const paraTrans = (Array.isArray(art.paragraph_translations) ? art.paragraph_translations : []).filter((t: unknown) => typeof t === 'string')
      row.translation = JSON.stringify({ texts: paraTrans, sentences, version: SENT_CACHE_VERSION })
      cacheParts++
      const tabs = deriveTabs(sentences, pick.level)
      if (tabs.vocab.length) { row.vocab = JSON.stringify(tabs.vocab); cacheParts++ }
      if (tabs.grammar.patterns.length) { row.grammar = JSON.stringify(tabs.grammar); cacheParts++ }
    }
  } catch (e) { console.warn('[daily-article-draft] analysis failed:', (e as Error).message) }

  try {
    const qRaw = await callClaude(sb, apiKey, 'daily-draft-quiz', MODEL_FAST, 1200,
      'Korean article (level: ' + pick.level + ')\nTitle: ' + art.title + '\n\nBODY START\n' + String(art.body).slice(0, 3000) + '\nBODY END\n\n---\n'
      + 'Create 5 fill-in-the-blank questions from this article. Return ONLY a JSON object: {"questions":[{"sentence":"Korean sentence with _____","sentence_en":"English translation with _____","blank":"correct word","blank_en":"English meaning","choices":["correct","wrong1","wrong2","wrong3"]}]}. No other text.',
      60_000)
    const q = extractJsonObject(qRaw)
    if (Array.isArray(q?.questions) && q.questions.length) { row.quiz = JSON.stringify(q); cacheParts++ }
  } catch (e) { console.warn('[daily-article-draft] quiz failed:', (e as Error).message) }

  const exprs = (Array.isArray(art.key_expressions) ? art.key_expressions : [])
    .filter((e: any) => e && e.ko && String(art.body).includes(e.ko)).slice(0, 3)
    .map((e: any) => ({ phrase: String(e.ko).trim(), note: String(e.en || '').trim(), color: 'amber' }))
  if (exprs.length) row.expressions = JSON.stringify(exprs)

  if (Object.keys(row).length) await saveCache(sb, id, row)
  return { id, title: art.title, cacheParts }
}

// ── handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, serviceKey)
  let lockHeld = false
  try {
    // Auth — same three paths as daily-content-gen.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const ok = (token && token === serviceKey) || (cronSecret.length >= 32 && token === cronSecret)
    if (!ok) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
      const check = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } })
      const user = check.ok ? await check.json() : null
      if (!user?.email || user.email !== ADMIN_EMAIL) return json({ error: 'Unauthorized' }, 401)
    }
    const opts = await req.json().catch(() => ({}))

    // Lock so overlapping ticks / a manual click don't double-build.
    const { data: lockRow } = await sb.from('app_settings').select('value').eq('key', LOCK_KEY).maybeSingle()
    const prev = lockRow?.value ? new Date(String(lockRow.value)).getTime() : 0
    if (prev && Date.now() - prev < LOCK_TTL_MS) return json({ ok: false, skipped: 'locked' }, 409)
    await sb.from('app_settings').upsert({ key: LOCK_KEY, value: new Date().toISOString() }, { onConflict: 'key' })
    lockHeld = true

    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) throw new Error('No Anthropic API key in app_settings')

    const { data: qRow } = await sb.from('app_settings').select('value').eq('key', QUEUE_KEY).maybeSingle()
    let queue: Queue | null = null
    try { queue = qRow?.value ? (typeof qRow.value === 'string' ? JSON.parse(qRow.value) : qRow.value) : null } catch (_) { queue = null }

    const saveQueue = (q: Queue) =>
      sb.from('app_settings').upsert({ key: QUEUE_KEY, value: JSON.stringify(q) }, { onConflict: 'key' })

    if (!queue || queue.date !== kstToday() || opts.force) {
      queue = await buildQueue(sb, apiKey)
      if (opts.dry_run) return json({ ok: true, dry_run: true, queue })
      await saveQueue(queue)
      // Fall through and build the first draft in this same tick.
    }
    if (opts.dry_run) return json({ ok: true, dry_run: true, queue })

    const pick = queue.picks.find((p) => p.status === 'pending' && p.attempts < MAX_ATTEMPTS)
    if (!pick) return json({ ok: true, idle: true, date: queue.date, picks: queue.picks.map((p) => ({ level: p.level, status: p.status, title: p.title_ko || p.headline.title })) })

    pick.attempts++
    try {
      const r = await buildDraft(sb, apiKey, pick)
      pick.status = 'done'; pick.article_id = r.id; pick.title_ko = r.title; delete pick.error
      await saveQueue(queue)
      return json({ ok: true, built: { level: pick.level, id: r.id, title: r.title, cache_parts: r.cacheParts } })
    } catch (e) {
      pick.error = String((e as Error).message || e).slice(0, 300)
      if (pick.attempts >= MAX_ATTEMPTS) pick.status = 'failed'
      await saveQueue(queue)
      throw e
    }
  } catch (e) {
    const msg = String((e as Error)?.message || e)
    console.error('[daily-article-draft]', msg)
    await sb.from('client_errors').insert({
      message: 'daily-article-draft: ' + msg.slice(0, 400), severity: 'error',
      context: { source: 'daily-article-draft' }, user_agent: 'edge-function',
    }).then(() => {}, () => {})
    return json({ ok: false, error: msg }, 500)
  } finally {
    if (lockHeld) await sb.from('app_settings').delete().eq('key', LOCK_KEY).then(() => {}, () => {})
  }
})
