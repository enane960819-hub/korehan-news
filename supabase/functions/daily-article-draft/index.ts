// Daily Article Draft — automates the admin "headline → body → analysis"
// pipeline up to (but NOT including) publish.
//
// Flow (one pg_cron tick every 5 min, 06:00–06:55 KST):
//   tick 1   : read ~30 publisher RSS feeds directly, drop items already in
//              `articles`, fetch the FULL text of ~45 fresh candidates
//              (unreadable pages / failed feeds are dropped), and have Haiku
//              pick 4 (one per level) + a section → queue in app_settings.
//   tick 2-5 : take the next queued pick and build ONE draft from the full
//              source text: Sonnet body → save article (status='draft') →
//              Haiku sentence analysis → Haiku quiz → article_cache rows.
//   buzz     : news drafts done → one tick picks today's Korea Buzz topic
//              from community hot lists (buzz.ts) and queues it; the next
//              tick writes it like any other draft (section 'buzz').
//   later    : queue empty → grammar harvest (see grammar-harvest.ts).
// One unit of work per invocation keeps every run well under the Edge
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
//   { "buzz": "dry" }   report today's Buzz candidate only
//   { "backfill": true } bake missing sentence analysis (overnight cron)
//   { "buzz": true }    queue a Buzz pick now (even before the news drafts)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { harvestGrammar } from './grammar-harvest.ts'
import { buzzMentionsSource, buzzPrompt, collectBuzz, pexelsImage } from './buzz.ts'
import { backfillAnalysis } from './backfill.ts'
import { analysisPrompt, deriveTabs, extractJsonObject, SENT_CACHE_VERSION, stitchSentences } from '../_shared/article-analysis.ts'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const QUEUE_KEY = 'daily_article_draft_queue'
const LOCK_KEY = 'daily_article_draft_lock'
const LOCK_TTL_MS = 4 * 60 * 1000
const MAX_ATTEMPTS = 2

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
  body_text?: string  // full article text extracted from the source page
}
type DraftPick = {
  headline: Headline; level: Level; section: string
  status: 'pending' | 'done' | 'failed'; attempts: number
  article_id?: string; title_ko?: string; error?: string
  kind?: 'news' | 'buzz'
}
type Queue = {
  date: string; created_at: string; picks: DraftPick[]; source_stats?: Record<string, unknown>
  buzz?: Record<string, unknown>  // set once today's Buzz pick was attempted (see buzz.ts)
}

// ── helpers ───────────────────────────────────────────────────
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}
// Unicode letters/digits so Japanese/Chinese/Cyrillic titles don't collapse
// to '' (same result as the old [^\w가-힣] rule for Korean/English).
function headlineKey(title = ''): string {
  return String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 140)
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

// ── step 1: sources → full article text → AI pick ─────────────
// Direct publisher RSS only — every item must link to a page we can read
// in full (Google-News redirect links and paywalls are useless here).
// A feed that fails, or an article whose body text we can't extract, is
// simply dropped; per-source counts are stored on the queue for review.
// Korean major outlets stay excluded (hero-image rights), same as the CMS.
const FEEDS: Array<{ id: string; label: string; section: string; url: string }> = [
  // World
  { id: 'bbc-world', label: 'BBC World', section: '국제', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'bbc-asia', label: 'BBC Asia', section: '국제', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { id: 'npr', label: 'NPR', section: '국제', url: 'https://feeds.npr.org/1001/rss.xml' },
  { id: 'guardian-world', label: 'Guardian World', section: '국제', url: 'https://www.theguardian.com/world/rss' },
  { id: 'aljazeera', label: 'Al Jazeera', section: '국제', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', label: 'DW', section: '국제', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'france24', label: 'France 24', section: '국제', url: 'https://www.france24.com/en/rss' },
  // Society / good news / explainers
  { id: 'goodnews', label: 'Good News Network', section: '사회', url: 'https://www.goodnewsnetwork.org/feed/' },
  { id: 'conversation', label: 'The Conversation', section: '사회', url: 'https://theconversation.com/global/articles.atom' },
  // Science / tech
  { id: 'bbc-tech', label: 'BBC Tech', section: 'IT과학', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id: 'sciencedaily', label: 'ScienceDaily', section: 'IT과학', url: 'https://www.sciencedaily.com/rss/top/science.xml' },
  { id: 'phys', label: 'Phys.org', section: 'IT과학', url: 'https://phys.org/rss-feed/' },
  { id: 'guardian-sci', label: 'Guardian Science', section: 'IT과학', url: 'https://www.theguardian.com/science/rss' },
  { id: 'techcrunch', label: 'TechCrunch', section: 'IT과학', url: 'https://techcrunch.com/feed/' },
  { id: 'verge', label: 'The Verge', section: 'IT과학', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'ars', label: 'Ars Technica', section: 'IT과학', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  // Nature
  { id: 'bbc-sci-env', label: 'BBC Science & Environment', section: 'nature', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { id: 'guardian-env', label: 'Guardian Environment', section: 'nature', url: 'https://www.theguardian.com/environment/rss' },
  { id: 'mongabay', label: 'Mongabay', section: 'nature', url: 'https://news.mongabay.com/feed/' },
  // History / culture / travel
  { id: 'smithsonian', label: 'Smithsonian', section: '역사', url: 'https://www.smithsonianmag.com/rss/latest_articles/' },
  { id: 'livescience', label: 'Live Science', section: '역사', url: 'https://www.livescience.com/feeds/all' },
  { id: 'atlasobscura', label: 'Atlas Obscura', section: 'travel', url: 'https://www.atlasobscura.com/feeds/latest' },
  { id: 'guardian-travel', label: 'Guardian Travel', section: 'travel', url: 'https://www.theguardian.com/travel/rss' },
  { id: 'guardian-food', label: 'Guardian Food', section: '문화', url: 'https://www.theguardian.com/food/rss' },
  // Entertainment / K-content
  { id: 'bbc-ent', label: 'BBC Entertainment', section: '해외연예', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { id: 'variety', label: 'Variety', section: '해외연예', url: 'https://variety.com/feed/' },
  { id: 'soompi', label: 'Soompi', section: 'K-pop', url: 'https://www.soompi.com/feed' },
  { id: 'koreaboo', label: 'Koreaboo', section: 'K-pop', url: 'https://www.koreaboo.com/feed/' },
  // Viral / quirky / feel-good (clickbait-style is fine — learners love these)
  { id: 'boredpanda', label: 'Bored Panda', section: '문화', url: 'https://www.boredpanda.com/feed/' },
  { id: 'oddity', label: 'Oddity Central', section: '문화', url: 'https://www.odditycentral.com/feed' },
  { id: 'upworthy', label: 'Upworthy', section: '사회', url: 'https://www.upworthy.com/feeds/feed.rss' },
  { id: 'dodo', label: 'The Dodo', section: 'nature', url: 'https://www.thedodo.com/rss' },
  { id: 'mentalfloss', label: 'Mental Floss', section: '역사', url: 'https://www.mentalfloss.com/rss.xml' },
  { id: 'ie', label: 'Interesting Engineering', section: 'IT과학', url: 'https://interestingengineering.com/feed' },
  { id: 'digg', label: 'Digg', section: '문화', url: 'https://digg.com/rss/top.rss' },
  { id: 'nypost-weird', label: 'NY Post Weird', section: '문화', url: 'https://nypost.com/tag/weird-but-true/feed/' },
  { id: 'mirror-weird', label: 'Mirror Weird News', section: '문화', url: 'https://www.mirror.co.uk/news/weird-news/?service=rss' },
  { id: 'unilad', label: 'UNILAD', section: '문화', url: 'https://www.unilad.com/rss' },
  // Non-English sources — Sonnet adapts any language into Korean.
  { id: 'nhk', label: 'NHK (日本語)', section: '국제', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
  { id: 'bbc-zh', label: 'BBC 中文', section: '국제', url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml' },
  { id: 'bbc-ja', label: 'BBC Japan (日本語)', section: '국제', url: 'https://feeds.bbci.co.uk/japanese/rss.xml' },
  { id: 'elpais', label: 'El País (Español)', section: '국제', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { id: 'bbc-mundo', label: 'BBC Mundo (Español)', section: '국제', url: 'https://feeds.bbci.co.uk/mundo/rss.xml' },
  { id: 'france24-fr', label: 'France 24 (Français)', section: '국제', url: 'https://www.france24.com/fr/rss' },
  { id: 'dw-de', label: 'DW (Deutsch)', section: '국제', url: 'https://rss.dw.com/rdf/rss-de-all' },
  { id: 'spiegel', label: 'Der Spiegel (Deutsch)', section: '국제', url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
  { id: 'bbc-vi', label: 'BBC Tiếng Việt', section: '국제', url: 'https://feeds.bbci.co.uk/vietnamese/rss.xml' },
  { id: 'bbc-pt', label: 'BBC Brasil (Português)', section: '국제', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },
  // Beauty / wellness
  { id: 'allure', label: 'Allure', section: 'beauty', url: 'https://www.allure.com/feed/rss' },
  { id: 'guardian-wellness', label: 'Guardian Wellness', section: 'beauty', url: 'https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss' },
]

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MIN_BODY_CHARS = 600     // shorter than this = teaser / paywall / video page → drop
const MIN_BODY_CHARS_CJK = 250 // Japanese/Chinese pack ~2.5× more per character
const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/
const MAX_BODY_CHARS = 9000    // enough for a full news story, bounded prompt cost
const FULLTEXT_POOL = 60       // how many candidates get their page fetched

function decodeEntities(s: string): string {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'").replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘').replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8212;|&mdash;/g, '—').replace(/&#8211;|&ndash;/g, '–').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}
function stripTags(s: string): string {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
function pickTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? stripTags(decodeEntities(m[1])) : ''
}

async function fetchFeed(f: typeof FEEDS[number]): Promise<Headline[]> {
  const r = await fetch(f.url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5' },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const xml = await r.text()
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  return blocks.slice(0, 15).map((b) => {
    let url = pickTag(b, 'link')
    if (!/^https?:\/\//.test(url)) {
      const m = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i)
      url = m ? decodeEntities(m[1]) : ''
    }
    const date = pickTag(b, 'pubDate') || pickTag(b, 'published') || pickTag(b, 'updated') || pickTag(b, 'dc:date')
    const t = new Date(date).getTime()
    return {
      title: pickTag(b, 'title'), url, source: f.label, category: f.section,
      published_at: Number.isNaN(t) ? '' : new Date(t).toISOString(),
      summary: (pickTag(b, 'description') || pickTag(b, 'summary')).slice(0, 300),
    } as Headline
  }).filter((h) => h.title && /^https?:\/\//.test(h.url))
}

// Pull the readable body out of an article page: prefer <article>, else
// the whole document; keep <p> blocks that look like prose.
async function fetchArticle(url: string): Promise<{ text: string; image: string } | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(7000), redirect: 'follow',
    })
    if (!r.ok || !/html/.test(r.headers.get('content-type') || '')) return null
    const html = (await r.text()).slice(0, 1_500_000)
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    let scope = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|figure|figcaption)[\s\S]*?<\/\1>/gi, ' ')
    const art = scope.match(/<article[\s\S]*?<\/article>/gi)
    if (art && art.length) scope = art.sort((a, b) => b.length - a.length)[0]
    const paras = (scope.match(/<p[\s>][\s\S]*?<\/p>/gi) || [])
      .map(stripTags)
      .filter((p) => p.length >= (CJK.test(p) ? 25 : 60) && !/^(sign up|subscribe|advertisement|read more|related:|copyright|©)/i.test(p))
    const seenP = new Set<string>()
    const text = paras.filter((p) => !seenP.has(p) && seenP.add(p)).join('\n\n').slice(0, MAX_BODY_CHARS)
    if (text.length < (CJK.test(text) ? MIN_BODY_CHARS_CJK : MIN_BODY_CHARS)) return null
    return { text, image: og ? decodeEntities(og[1]) : '' }
  } catch (_) { return null }
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

  // 1. All feeds in parallel; failures are recorded and skipped.
  const sourceStats: Record<string, { items: number; readable: number; error?: string }> = {}
  const perFeed = await Promise.all(FEEDS.map(async (f) => {
    try {
      const items = await fetchFeed(f)
      sourceStats[f.id] = { items: items.length, readable: 0 }
      return items
    } catch (e) {
      sourceStats[f.id] = { items: 0, readable: 0, error: String((e as Error).message || e).slice(0, 60) }
      return [] as Headline[]
    }
  }))

  // 2. Fresh + not already published; round-robin across feeds (newest
  //    first) so one busy feed can't crowd out the rest.
  const threeDays = 3 * 86400_000
  const queues = perFeed.map((items) => items
    .filter((h) => { const k = headlineKey(h.title); return !seen.has(String(h.url).trim()) && !(k && seen.has(k)) })
    .filter((h) => { const t = h.published_at ? new Date(h.published_at).getTime() : Date.now(); return Date.now() - t <= threeDays })
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))))
  const pool: Headline[] = []
  for (let round = 0; pool.length < FULLTEXT_POOL && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && pool.length < FULLTEXT_POOL) pool.push(q[round])
  }

  // 3. Read every candidate's full page; drop the ones we can't read.
  const feedIdByLabel: Record<string, string> = {}
  FEEDS.forEach((f) => { feedIdByLabel[f.label] = f.id })
  const candidates: Headline[] = []
  for (let i = 0; i < pool.length; i += 12) {
    const got = await Promise.all(pool.slice(i, i + 12).map(async (h) => ({ h, a: await fetchArticle(h.url) })))
    for (const { h, a } of got) {
      if (!a) continue
      h.body_text = a.text
      if (a.image) h.image = a.image
      candidates.push(h)
      const id = feedIdByLabel[h.source || '']
      if (id && sourceStats[id]) sourceStats[id].readable++
    }
  }
  const stats = `feeds_ok=${Object.values(sourceStats).filter((s) => !s.error).length}/${FEEDS.length} fresh_pool=${pool.length} readable=${candidates.length}`
  console.log('[daily-article-draft]', stats, JSON.stringify(sourceStats))
  if (candidates.length < 4) throw new Error(`only ${candidates.length} readable articles (${stats})`)

  // 4. Haiku picks 4 (one per level) from title + opening of the real text.
  const list = candidates.map((h, i) =>
    `${i}. [${h.source}]${h.image ? ' [img]' : ''} ${h.title}\n   ${String(h.body_text).replace(/\s+/g, ' ').slice(0, 260)}`
  ).join('\n')
  const selectPrompt =
    'You pick today\'s news stories for a Korean-learning site for foreign learners. Each story will be rewritten in Korean at one TOPIK level.\n\n'
    + 'Candidates (title + opening of the full article; sources may be in any language):\n' + list + '\n\n'
    + 'Pick EXACTLY 4 different stories — one for each level: Starter (absolute beginner), Beginner (TOPIK 1-2), Intermediate (TOPIK 3-4), Advanced (TOPIK 5-6).\n'
    + 'Criteria, in order:\n'
    + '1. Learner interest: surprising, useful, warm or culturally interesting; Korea-related stories are a plus.\n'
    + '2. Level fit: Starter/Beginner get simple concrete topics (animals, food, daily life, light culture). Heavier topics (politics, economy, conflict) only for Intermediate/Advanced.\n'
    + '3. Avoid: graphic violence, death tolls, sexual content, partisan politics framing, gossip, pure listicles/ads/product roundups.\n'
    + '4. Variety: 4 different sections and different sources. Prefer [img] stories. Fun viral/quirky stories are welcome, especially for Starter/Beginner.\n\n'
    + 'Sections (use the exact key): ' + SECTIONS.map((s) => `${s.key} (${s.topics})`).join('; ') + '\n\n'
    + 'Return ONLY JSON: {"picks":[{"idx":<number>,"level":"Starter|Beginner|Intermediate|Advanced","section":"<key>"}]}'
  const out = extractJsonObject(await callClaude(sb, apiKey, 'daily-draft-select', MODEL_FAST, 600, selectPrompt, 45_000))

  const sectionKeys = new Set(SECTIONS.map((s) => s.key))
  const usedIdx = new Set<number>(), usedLvl = new Set<string>()
  const picks: DraftPick[] = []
  const sectionFor = (h: Headline, want?: string) => want && sectionKeys.has(want) ? want : (h.category && sectionKeys.has(h.category) ? h.category : '문화')
  for (const p of (out?.picks || [])) {
    const idx = Number(p?.idx), lvl = String(p?.level || '') as Level
    if (!candidates[idx] || usedIdx.has(idx) || !LEVELS.includes(lvl) || usedLvl.has(lvl)) continue
    usedIdx.add(idx); usedLvl.add(lvl)
    picks.push({ headline: candidates[idx], level: lvl, section: sectionFor(candidates[idx], p?.section), status: 'pending', attempts: 0 })
  }
  // Fill any level the model skipped with the next unused candidate.
  for (const lvl of LEVELS) {
    if (usedLvl.has(lvl)) continue
    const idx = candidates.findIndex((_, i) => !usedIdx.has(i))
    if (idx < 0) break
    usedIdx.add(idx); usedLvl.add(lvl)
    picks.push({ headline: candidates[idx], level: lvl, section: sectionFor(candidates[idx]), status: 'pending', attempts: 0 })
  }
  return { date: kstToday(), created_at: new Date().toISOString(), picks, source_stats: sourceStats }
}

// ── step 2: one draft ─────────────────────────────────────────
function bodyPrompt(h: Headline, level: Level, section: string): string {
  const L = LEVEL_INFO[level]
  const today = new Date(Date.now() + 9 * 3600_000)
  const todayKo = `${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`
  return '당신은 외국인 한국어 학습자를 위한 뉴스 기사 편집자입니다.\n\n'
    + '[원본 뉴스 — 원문 기사 전체]\n제목: ' + h.title + '\n출처: ' + (h.source || '') + '\n본문:\n' + (h.body_text || h.desc || h.summary || '(본문 없음)') + '\n\n'
    + '[각색 방법] 위 원문 전체를 읽고 핵심 사실만 골라 학습자용 한국어 기사로 재구성하세요. 원문의 모든 디테일을 옮길 필요는 없습니다 — 레벨에 맞게 중요한 사실 위주로 압축.\n\n'
    + '[지시사항]\n'
    + '- 원본의 핵심 사실과 주제 유지. 원문이 영어·일본어·중국어·스페인어 등 어떤 언어든 한국어로 번역·각색.\n'
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

// Admin "AI Auto-Generate" jobs (article_gen_jobs) pass the save status and
// the source video chosen in the CMS.
type BodyOpts = { status?: string; video?: { url: string; kind: string; fallback?: string; use?: boolean } }

async function buildDraft(sb: any, apiKey: string, pick: DraftPick): Promise<{ id: string; title: string; cacheParts: number }> {
  const b = await buildBody(sb, apiKey, pick)
  const cacheParts = await analyzeAndCache(sb, apiKey, b.id, b.title, b.body, pick.level, b.paragraphTranslations, b.keyExpressions)
  return { id: b.id, title: b.title, cacheParts }
}

// Step 1: Sonnet body → article row (status draft unless the admin chose published).
async function buildBody(sb: any, apiKey: string, pick: DraftPick, opts: BodyOpts = {}): Promise<{
  id: string; title: string; body: string; paragraphTranslations: string[]; keyExpressions: any[]
}> {
  const h = pick.headline
  const isBuzz = pick.kind === 'buzz'
  // CMS picks carry only the RSS summary — read the full source page when we can.
  if (!isBuzz && !h.body_text && h.url) {
    const full = await fetchArticle(h.url)
    if (full) { h.body_text = full.text; if (!h.image && full.image) h.image = full.image }
  }
  const video = opts.video && opts.video.url && opts.video.kind ? opts.video : null
  const today = new Date(Date.now() + 9 * 3600_000)
  const todayKo = `${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`
  const bodyRaw = isBuzz
    ? await callClaude(sb, apiKey, 'buzz-body', MODEL_BODY, 4000, buzzPrompt(h.title, h.source || '', h.body_text || '', todayKo))
    : await callClaude(sb, apiKey, 'daily-draft-body', MODEL_BODY, 4000, bodyPrompt(h, pick.level, pick.section))
  // Forest-level bodies + translations can run past 4000 tokens and get cut
  // mid-JSON ("JSON parse failed after repair"). Retry once with more room
  // and a stricter reminder instead of failing the day's Advanced draft.
  let art: any = null
  try { art = extractJsonObject(bodyRaw) } catch (_) { art = null }
  if (!art?.body) {
    const retryPrompt = (isBuzz ? buzzPrompt(h.title, h.source || '', h.body_text || '', todayKo) : bodyPrompt(h, pick.level, pick.section))
      + '\n\nIMPORTANT: Return ONE complete, valid JSON object only. Keep the body within the paragraph limit so the JSON is not cut off.'
    const raw2 = await callClaude(sb, apiKey, isBuzz ? 'buzz-body-retry' : 'daily-draft-body-retry', MODEL_BODY, 7000, retryPrompt)
    art = extractJsonObject(raw2)
  }
  if (isBuzz && art?.safe === false) throw new Error('unsafe topic: ' + String(art.reason || '').slice(0, 120))
  if (!art?.title || !art?.body) throw new Error('invalid body JSON')
  // The body must open on the issue, not on "an online community post".
  if (isBuzz && buzzMentionsSource(art.body)) {
    try {
      const fixRaw = await callClaude(sb, apiKey, 'buzz-body-nosource', MODEL_BODY, 5000,
        buzzPrompt(h.title, h.source || '', h.body_text || '', todayKo)
        + '\n\nIMPORTANT: 이전 답변이 출처(온라인 커뮤니티·게시글·네티즌)를 언급했습니다. 출처 언급을 모두 빼고 첫 문장부터 이슈 자체만 말하세요. JSON 하나만 출력.')
      const fixed = extractJsonObject(fixRaw)
      if (fixed?.title && fixed?.body && fixed.safe !== false && !buzzMentionsSource(fixed.body)) art = fixed
    } catch (_) { /* keep the first version; it is a draft the admin reviews */ }
  }

  const id = uid()
  const image = video && video.use ? '' : await persistImage(sb, isBuzz ? await pexelsImage(sb, art.image_query) : (h.image || ''), id)
  const titleEn = (typeof art.title_en === 'string' && art.title_en.trim()) || (/[ㄱ-힝]/.test(h.title) ? '' : h.title)
  const row0: Record<string, unknown> = {
    id, section: pick.section, title: art.title, body: art.body, title_en: titleEn,
    date: new Date().toISOString().slice(0, 10), status: opts.status === 'published' ? 'published' : 'draft', featured: false,
    level: pick.level, source_url: h.url || '', image,
  }
  if (video) {
    row0.video_url = video.url; row0.video_kind = video.kind
    row0.video_fallback_url = video.fallback || ''; row0.use_video = !!video.use
  }
  if (isBuzz && art.netizen_talk && typeof art.netizen_talk === 'object') {
    const nt = art.netizen_talk
    row0.netizen_talk = {
      summary_en: String(nt.summary_en || '').slice(0, 300),
      reactions: (Array.isArray(nt.reactions) ? nt.reactions : []).filter((r: any) => r?.ko).slice(0, 5)
        .map((r: any) => ({ ko: String(r.ko).slice(0, 120), en: String(r.en || '').slice(0, 200) })),
      slang: (Array.isArray(nt.slang) ? nt.slang : []).filter((x: any) => x?.term).slice(0, 4)
        .map((x: any) => ({ term: String(x.term).slice(0, 30), meaning: String(x.meaning || '').slice(0, 160),
          example_ko: String(x.example_ko || '').slice(0, 120), example_en: String(x.example_en || '').slice(0, 200) })),
    }
  }
  await saveArticle(sb, row0)
  return {
    id, title: art.title, body: art.body,
    paragraphTranslations: (Array.isArray(art.paragraph_translations) ? art.paragraph_translations : []).filter((t: unknown) => typeof t === 'string'),
    keyExpressions: Array.isArray(art.key_expressions) ? art.key_expressions : [],
  }
}

// Step 2: Haiku sentence analysis + quiz → article_cache. Reads the body it
// is given (for CMS jobs: re-read from the DB, so the admin's edits count).
async function analyzeAndCache(
  sb: any, apiKey: string, id: string, title: string, body: string, level: Level,
  paraTrans: string[], keyExprs: any[],
): Promise<number> {
  const art = { title, body }
  // Analysis + quiz. A failure here leaves a valid draft; the admin can
  // re-bake from AI Cache Management or the reader's ⚡ button.
  const row: Record<string, string> = {}
  let cacheParts = 0
  try {
    const aRaw = await callClaude(sb, apiKey, 'daily-draft-analysis', MODEL_FAST, 8000, analysisPrompt(art.title, art.body, level))
    const aJson = extractJsonObject(aRaw)
    const rawSents: any[] = Array.isArray(aJson?.sentences) ? aJson.sentences : []
    const sentences = stitchSentences(art.body, rawSents)
    if (sentences.some((s) => s.translation || s.vocab.length || s.analysis.length)) {
      row.translation = JSON.stringify({ texts: paraTrans, sentences, version: SENT_CACHE_VERSION })
      cacheParts++
      const tabs = deriveTabs(sentences, level)
      if (tabs.vocab.length) { row.vocab = JSON.stringify(tabs.vocab); cacheParts++ }
      if (tabs.grammar.patterns.length) { row.grammar = JSON.stringify(tabs.grammar); cacheParts++ }
    }
  } catch (e) { console.warn('[daily-article-draft] analysis failed:', (e as Error).message) }

  try {
    const qRaw = await callClaude(sb, apiKey, 'daily-draft-quiz', MODEL_FAST, 1200,
      'Korean article (level: ' + level + ')\nTitle: ' + art.title + '\n\nBODY START\n' + String(art.body).slice(0, 3000) + '\nBODY END\n\n---\n'
      + 'Create 5 fill-in-the-blank questions from this article. Return ONLY a JSON object: {"questions":[{"sentence":"Korean sentence with _____","sentence_en":"English translation with _____","blank":"correct word","blank_en":"English meaning","choices":["correct","wrong1","wrong2","wrong3"]}]}. No other text.',
      60_000)
    const q = extractJsonObject(qRaw)
    if (Array.isArray(q?.questions) && q.questions.length) { row.quiz = JSON.stringify(q); cacheParts++ }
  } catch (e) { console.warn('[daily-article-draft] quiz failed:', (e as Error).message) }

  const exprs = keyExprs
    .filter((e: any) => e && e.ko && String(art.body).includes(e.ko)).slice(0, 3)
    .map((e: any) => ({ phrase: String(e.ko).trim(), note: String(e.en || '').trim(), color: 'amber' }))
  if (exprs.length) row.expressions = JSON.stringify(exprs)

  if (Object.keys(row).length) await saveCache(sb, id, row)
  return cacheParts
}

// ── admin generation jobs (article_gen_jobs) ──────────────────
// The CMS "AI Auto-Generate" page used to run body + analysis in the
// admin's browser, so closing the tab lost the batch. Now it only enqueues:
//   {enqueue:[{headline, section, level, save_status, video}]} → body jobs
//   {enqueue_analysis:[article_id…]} → analysis jobs (after the admin's review)
//   {jobs:true} → worker: runs ONE pending job (pg_cron calls it every minute
//                 while jobs are waiting; 20261028_article_gen_jobs.sql).
const JOB_MAX_ATTEMPTS = 2
const JOB_STALE_MS = 6 * 60 * 1000

async function genJobs(sb: any, opts: any): Promise<Record<string, unknown>> {
  if (Array.isArray(opts.enqueue)) {
    const rows = opts.enqueue.slice(0, 40).map((it: any) => {
      const h = it?.headline || {}
      return {
        kind: 'body',
        payload: {
          headline: {
            title: String(h.title || '').slice(0, 300), url: String(h.url || h.link || '').slice(0, 1000),
            source: String(h.source || '').slice(0, 100), desc: String(h.desc || h.summary || '').slice(0, 4000),
            image: String(h.image || '').slice(0, 1000),
          },
          section: String(it.section || '사회').slice(0, 40),
          level: (LEVELS as readonly string[]).includes(it.level) ? it.level : 'Intermediate',
          save_status: it.save_status === 'published' ? 'published' : 'draft',
          video: h.video_url && h.video_kind ? {
            url: String(h.video_url).slice(0, 1000), kind: String(h.video_kind).slice(0, 30),
            fallback: String(h.video_fallback_url || '').slice(0, 1000), use: !!it.use_video,
          } : null,
        },
      }
    }).filter((r: any) => r.payload.headline.title)
    if (!rows.length) return { ok: false, error: 'no_headlines' }
    const { data, error } = await sb.from('article_gen_jobs').insert(rows).select('id')
    if (error) throw new Error('enqueue: ' + error.message)
    return { ok: true, queued: (data || []).map((r: any) => r.id) }
  }

  if (Array.isArray(opts.enqueue_analysis)) {
    const ids = opts.enqueue_analysis.map((x: unknown) => String(x)).slice(0, 40)
    const { data: existing } = await sb.from('article_gen_jobs').select('article_id, kind, status, result, payload').in('article_id', ids)
    const rows: any[] = []
    for (const id of ids) {
      const mine = (existing || []).filter((j: any) => j.article_id === id)
      if (mine.some((j: any) => j.kind === 'analysis' && j.status !== 'failed')) continue
      const bodyJob = mine.find((j: any) => j.kind === 'body' && j.status === 'done')
      rows.push({
        kind: 'analysis', article_id: id,
        payload: {
          paragraph_translations: bodyJob?.result?.paragraph_translations || [],
          key_expressions: bodyJob?.result?.key_expressions || [],
          headline: { title: bodyJob?.payload?.headline?.title || '' },
        },
      })
    }
    if (rows.length) {
      const { error } = await sb.from('article_gen_jobs').insert(rows)
      if (error) throw new Error('enqueue_analysis: ' + error.message)
    }
    return { ok: true, queued: rows.length }
  }

  // Worker. Release crashed runs first.
  const staleBefore = new Date(Date.now() - JOB_STALE_MS).toISOString()
  const { data: stale } = await sb.from('article_gen_jobs').select('id, attempts').eq('status', 'running').lt('started_at', staleBefore)
  for (const j of stale || []) {
    await sb.from('article_gen_jobs').update({
      status: j.attempts >= JOB_MAX_ATTEMPTS ? 'failed' : 'pending', error: 'timed out', updated_at: new Date().toISOString(),
    }).eq('id', j.id).eq('status', 'running')
  }
  const { data: next } = await sb.from('article_gen_jobs').select('id, attempts').eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!next) return { ok: true, idle: true }
  const { data: claimed } = await sb.from('article_gen_jobs')
    .update({ status: 'running', attempts: next.attempts + 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', next.id).eq('status', 'pending').select('*').maybeSingle()
  if (!claimed) return { ok: true, raced: true }

  const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
  const apiKey = setting?.value
  const p = claimed.payload || {}
  try {
    if (!apiKey) throw new Error('No Anthropic API key in app_settings')
    let result: Record<string, unknown>
    let articleId = claimed.article_id
    if (claimed.kind === 'body') {
      const pick: DraftPick = { headline: { ...p.headline }, level: p.level, section: p.section, status: 'pending', attempts: 0, kind: 'news' }
      const b = await buildBody(sb, apiKey, pick, { status: p.save_status, video: p.video || undefined })
      articleId = b.id
      result = { title: b.title, paragraph_translations: b.paragraphTranslations, key_expressions: b.keyExpressions }
    } else {
      const { data: art } = await sb.from('articles').select('id, title, body, level').eq('id', claimed.article_id).maybeSingle()
      if (!art?.body) throw new Error('article not found')
      const level: Level = (LEVELS as readonly string[]).includes(art.level) ? art.level : 'Intermediate'
      const parts = await analyzeAndCache(sb, apiKey, art.id, art.title || '', art.body, level,
        Array.isArray(p.paragraph_translations) ? p.paragraph_translations : [], Array.isArray(p.key_expressions) ? p.key_expressions : [])
      result = { title: art.title, cache_parts: parts }
    }
    await sb.from('article_gen_jobs').update({
      status: 'done', article_id: articleId, result, error: null, updated_at: new Date().toISOString(),
    }).eq('id', claimed.id)
    return { ok: true, done: claimed.id, kind: claimed.kind, article_id: articleId }
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300)
    await sb.from('article_gen_jobs').update({
      status: claimed.attempts >= JOB_MAX_ATTEMPTS ? 'failed' : 'pending', error: msg, updated_at: new Date().toISOString(),
    }).eq('id', claimed.id)
    return { ok: false, job: claimed.id, error: msg }
  }
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

    // Admin "AI Auto-Generate" jobs run outside the daily lock (see genJobs).
    if (opts.enqueue || opts.enqueue_analysis || opts.jobs) return json(await genJobs(sb, opts))

    // Lock so overlapping ticks / a manual click don't double-build.
    const { data: lockRow } = await sb.from('app_settings').select('value').eq('key', LOCK_KEY).maybeSingle()
    const prev = lockRow?.value ? new Date(String(lockRow.value)).getTime() : 0
    if (prev && Date.now() - prev < LOCK_TTL_MS) return json({ ok: false, skipped: 'locked' }, 409)
    await sb.from('app_settings').upsert({ key: LOCK_KEY, value: new Date().toISOString() }, { onConflict: 'key' })
    lockHeld = true

    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) throw new Error('No Anthropic API key in app_settings')

    // {"backfill":true}: overnight cron — bake sentence analysis for published
    // articles that don't have it yet (see backfill.ts). No draft work.
    if (opts.backfill) {
      const r = await backfillAnalysis(sb,
        (prompt) => callClaude(sb, apiKey, 'analysis-backfill', MODEL_FAST, 8000, prompt, 110_000), kstToday())
      return json({ ok: true, backfill: r })
    }

    // {"buzz":"dry"}: report today's Buzz candidate only (no queue, no writes).
    const pickBuzz = () => collectBuzz(sb,
      (prompt) => callClaude(sb, apiKey, 'buzz-select', MODEL_FAST, 500, prompt, 45_000), extractJsonObject)
    if (opts.buzz === 'dry') {
      const res = await pickBuzz()
      return json({ ok: true, dry_run: true, buzz: 'candidate' in res
        ? { ...res.candidate, body_text: res.candidate.body_text.slice(0, 1500), reason: res.reason } : res })
    }

    const { data: qRow } = await sb.from('app_settings').select('value').eq('key', QUEUE_KEY).maybeSingle()
    let queue: Queue | null = null
    try { queue = qRow?.value ? (typeof qRow.value === 'string' ? JSON.parse(qRow.value) : qRow.value) : null } catch (_) { queue = null }

    const saveQueue = (q: Queue) =>
      sb.from('app_settings').upsert({ key: QUEUE_KEY, value: JSON.stringify(q) }, { onConflict: 'key' })

    if (!queue || queue.date !== kstToday() || opts.force) {
      queue = await buildQueue(sb, apiKey)
      if (opts.dry_run) return json({ ok: true, dry_run: true, queue })
      await saveQueue(queue)
      // Reading ~45 pages already used this tick's budget — drafts start next tick.
      return json({
        ok: true, queued: queue.picks.map((p) => ({ level: p.level, section: p.section, source: p.headline.source, title: p.headline.title })),
        source_stats: queue.source_stats,
      })
    }
    if (opts.dry_run) return json({ ok: true, dry_run: true, queue })

    // Buzz: once the news drafts are done (or on demand with {"buzz":true}),
    // spend one tick finding today's community topic → queued as a pick.
    const newsPending = queue.picks.some((p) => p.status === 'pending' && p.attempts < MAX_ATTEMPTS)
    if (opts.buzz === true || (!newsPending && !queue.buzz)) {
      const today = kstToday()
      const res = await pickBuzz()
      if ('candidate' in res) {
        const c = res.candidate
        queue.picks.push({
          kind: 'buzz', level: 'Intermediate', section: 'buzz', status: 'pending', attempts: 0,
          headline: { title: c.title, url: c.url, source: c.source, body_text: c.body_text, category: 'buzz' },
        })
        queue.buzz = { date: today, picked: c.title, source: c.source, reason: res.reason }
      } else {
        queue.buzz = { date: today, none: res.none, stats: res.stats }
      }
      await saveQueue(queue)
      return json({ ok: true, buzz: queue.buzz })
    }

    const pick = queue.picks.find((p) => p.status === 'pending' && p.attempts < MAX_ATTEMPTS)
    if (!pick) {
      // Drafts are done for today → spend an idle tick on the grammar harvest.
      let harvest: Record<string, unknown> | null = null
      try {
        harvest = await harvestGrammar(sb,
          (prompt) => callClaude(sb, apiKey, 'grammar-harvest', MODEL_BODY, 8000, prompt, 120_000),
          extractJsonObject, kstToday(), !!opts.harvest)
      } catch (e) {
        harvest = { error: String((e as Error).message || e).slice(0, 300) }
        await sb.from('client_errors').insert({
          message: 'grammar-harvest: ' + String(harvest.error), severity: 'error',
          context: { source: 'daily-article-draft' }, user_agent: 'edge-function',
        }).then(() => {}, () => {})
      }
      return json({ ok: true, idle: true, date: queue.date, harvest, picks: queue.picks.map((p) => ({ level: p.level, status: p.status, title: p.title_ko || p.headline.title })) })
    }

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
