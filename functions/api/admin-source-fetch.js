// Headline sources. Korean major news outlets are intentionally excluded
// because they aggressively defend their hero-image rights; everything
// else (Reddit's public JSON, aggregator RSS, international publisher
// RSS) stays in. Source URL is preserved on every article for
// attribution.

// Upstreams that gate on User-Agent. Google News aggressively rate-limits
// generic bot UAs from datacenter egress, so we present a current
// desktop-browser UA plus the headers a real browser sends.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const SOURCE_CATALOG = [
  // ── International news (publisher-provided RSS) ─────────────────
  { id:'bbc-world', label:'BBC World', kind:'rss', category:'국제', url:'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id:'bbc-tech', label:'BBC Tech', kind:'rss', category:'문화', url:'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id:'bbc-sport', label:'BBC Sport', kind:'rss', category:'스포츠', url:'https://feeds.bbci.co.uk/sport/rss.xml' },
  { id:'npr-news', label:'NPR News', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:npr.org&hl=en-US&gl=US&ceid=US:en' },
  { id:'reuters-world', label:'Reuters World', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en' },
  { id:'ap-top', label:'AP Top News', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'guardian-world', label:'Guardian World', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:theguardian.com+world&hl=en-US&gl=US&ceid=US:en' },
  { id:'aljazeera', label:'Al Jazeera English', kind:'rss', category:'국제', url:'https://www.aljazeera.com/xml/rss/all.xml' },
  { id:'cnn-top', label:'CNN Top Stories', kind:'rss', category:'국제', url:'http://rss.cnn.com/rss/edition.rss' },

  // ── Tech / Trends (RSS) ─────────────────────────────────────────
  { id:'techcrunch', label:'TechCrunch', kind:'rss', category:'문화', url:'https://techcrunch.com/feed/' },
  { id:'theverge', label:'The Verge', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:theverge.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'arstechnica', label:'Ars Technica', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:arstechnica.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'wired', label:'WIRED', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:wired.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'gtrends-us', label:'Google Trends US', kind:'rss', category:'국제', url:'https://trends.google.com/trending/rss?geo=US' },
  { id:'gtrends-kr', label:'Google Trends KR', kind:'rss', category:'문화', url:'https://trends.google.com/trending/rss?geo=KR' },

  // ── Lifestyle / Travel / Beauty / Food ──────────────────────────
  { id:'gn-viral', label:'Google News Viral', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=viral+OR+trending+OR+went+viral&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-beauty', label:'Beauty Trends', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=beauty+trend+OR+skincare+OR+makeup&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-travel', label:'Travel Trends', kind:'rss', category:'travel', url:'https://news.google.com/rss/search?q=travel+trend+OR+destination+viral+OR+tourism&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-food', label:'Food Trends', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=food+trend+OR+recipe+OR+restaurant+viral&hl=en-US&gl=US&ceid=US:en' },
  { id:'allure', label:'Allure Beauty', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=site:allure.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'cnet-travel', label:'CNET Travel', kind:'rss', category:'travel', url:'https://news.google.com/rss/search?q=site:cnet.com+travel+OR+lifestyle&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-health', label:'Health Trends', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=health+OR+wellness+OR+nutrition+trend&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-fashion', label:'Fashion Trends', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=fashion+trend+OR+streetwear+OR+runway&hl=en-US&gl=US&ceid=US:en' },

  // ── Entertainment / K-content (English-language only) ──────────
  { id:'gn-kdrama', label:'K-drama News', kind:'rss', category:'K-pop', url:'https://news.google.com/rss/search?q=kdrama+OR+"korean+drama"+OR+"k-pop"&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-movies', label:'Movies & TV', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=movie+OR+film+OR+"netflix+series"+trending&hl=en-US&gl=US&ceid=US:en' },
  { id:'soompi', label:'Soompi (K-content)', kind:'rss', category:'K-pop', url:'https://www.soompi.com/feed' },
  { id:'gn-gaming', label:'Gaming News', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=video+game+OR+gaming+launch+OR+"new+release"+game&hl=en-US&gl=US&ceid=US:en' },

  // ── Wikinews (CC-BY 2.5 — full content + image free to adapt) ───
  // Pulls the latest articles in Category:Published via the MediaWiki
  // API, then extracts intro paragraph + main image in a single
  // batched query. Output shape matches the RSS handlers so the
  // admin picker UI doesn't need any source-specific handling.
  { id:'wikinews-en', label:'Wikinews EN', kind:'wikinews', category:'국제', lang:'en' },
  { id:'wikinews-ko', label:'Wikinews KO', kind:'wikinews', category:'국제', lang:'ko' },

  // ── Hacker News (link aggregator, no hotlinked imagery) ─────────
  { id:'hn', label:'Hacker News', kind:'hn', category:'문화' },

  // Clickbait / Viral RSS aggregators
  { id:'gn-clickbait', label:'Viral Clickbait', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=shocking+OR+unbelievable+OR+goes+viral+OR+mind+blowing&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-listicle', label:'Listicles', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=top+10+OR+best+of+OR+reasons+why&hl=en-US&gl=US&ceid=US:en' },
  { id:'boredpanda', label:'BoredPanda', kind:'rss', category:'문화', url:'https://www.boredpanda.com/feed/' },

  // ── Interesting / Viral (replacing Reddit interest subs) ────────
  { id:'smithsonianmag', label:'Smithsonian Mag', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:smithsonianmag.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'sciencealert', label:'ScienceAlert', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:sciencealert.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'iflscience', label:'IFLScience', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:iflscience.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'mentalfloss', label:'Mental Floss', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:mentalfloss.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'atlasobscura', label:'Atlas Obscura', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:atlasobscura.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'odditycentral', label:'Oddity Central', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:odditycentral.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'natgeo', label:'National Geographic', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:nationalgeographic.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'ladbible', label:'LADbible', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:ladbible.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'popsci', label:'Popular Science', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=site:popsci.com&hl=en-US&gl=US&ceid=US:en' },

  // ── K-content (replacing reddit-kpop / reddit-korea) ─────────────
  { id:'allkpop', label:'AllKpop', kind:'rss', category:'K-pop', url:'https://news.google.com/rss/search?q=site:allkpop.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'koreaboo', label:'Koreaboo', kind:'rss', category:'K-pop', url:'https://news.google.com/rss/search?q=site:koreaboo.com&hl=en-US&gl=US&ceid=US:en' },

  // ── Sports (replacing reddit-sports) ─────────────────────────────
  { id:'espn', label:'ESPN', kind:'rss', category:'스포츠', url:'https://news.google.com/rss/search?q=site:espn.com&hl=en-US&gl=US&ceid=US:en' },
]

function cors(extra={}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization,apikey,x-supabase-url',
    ...extra,
  }
}

function stripHtml(v='') {
  return String(v).replace(/<[^>]*>?/g, ' ').replace(/\s+/g, ' ').trim()
}
function decodeEntities(str='') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
function pickTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? stripHtml(decodeEntities(m[1])) : ''
}
function pickAttr(block, tag, attr) {
  const m = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"[^>]*>`, 'i'))
  return m ? decodeEntities(m[1]) : ''
}
function toIso(v='') {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}
function headlineKey(title='') {
  return String(title).toLowerCase().replace(/[^\w가-힣]+/g, '').slice(0, 140)
}
function isRecent(iso, days=9) {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t <= days * 86400000
}

async function fetchRss(source) {
  // Per-source timeout — without this, a single hung upstream (rare but
  // happens — Soompi / Google News occasionally take >30 s) blew past
  // the client's 18 s wait and surfaced as "소스 수집 서버 호출에
  // 실패했습니다." even though most sources had returned fine.
  // 8 s × Promise.allSettled in the caller means the slowest 5% drops
  // out cleanly instead of poisoning the whole batch.
  const res = await fetch(source.url, {
    headers: {
      'user-agent': BROWSER_UA,
      'accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('upstream_not_ok')
  const xml = await res.text()
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  return itemMatches.slice(0, 20).map((block) => {
    const title = pickTag(block, 'title')
    const summary = pickTag(block, 'description') || pickTag(block, 'summary') || pickTag(block, 'content')
    const url = pickTag(block, 'link') || pickAttr(block, 'link', 'href')
    const published_at = toIso(pickTag(block, 'pubDate') || pickTag(block, 'published') || pickTag(block, 'updated'))
    return {
      title,
      source: source.label,
      url,
      published_at,
      summary: summary.slice(0, 280),
      category: source.category,
      image: extractRssImage(block) || null,
    }
  })
}

// Pull a usable thumbnail URL out of an RSS <item>. Sources encode it
// five different ways and the old implementation only tried <media:thumbnail>
// text content — but these elements are self-closing and carry the URL in
// the `url=` attribute, so text extraction was always empty. Cover the
// real formats:
//   <media:thumbnail url="..."/>
//   <media:content  url="..." medium="image"/>
//   <enclosure url="..." type="image/*"/>
//   <image><url>...</url></image>    (RSS 2.0 channel-level, rare inside item)
//   <description><![CDATA[<img src="..."/>...]]></description>   (WordPress, BoredPanda)
function extractRssImage(block) {
  const candidates = [
    pickAttr(block, 'media:thumbnail', 'url'),
    pickAttr(block, 'media:content', 'url'),
  ]
  // <enclosure url="..." type="image/jpeg"/> — only take when type starts with image/
  const encMatch = block.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image\/[^"]+"[^>]*>/i)
    || block.match(/<enclosure[^>]+type="image\/[^"]+"[^>]*url="([^"]+)"[^>]*>/i)
  if (encMatch) candidates.push(decodeEntities(encMatch[1]))
  // Nested <image><url>…</url></image>
  const imgBlock = block.match(/<image[^>]*>([\s\S]*?)<\/image>/i)
  if (imgBlock) candidates.push(pickTag(imgBlock[1], 'url'))
  // First <img src="…"> inside description/content HTML
  const htmlImg = block.match(/<img[^>]+src="([^"]+)"/i)
  if (htmlImg) candidates.push(decodeEntities(htmlImg[1]))
  const first = candidates.find((u) => u && /^https?:\/\//i.test(u))
  return first || ''
}

// Last-ditch image fallback when both RSS and og:image came up empty
// (Reddit self posts, HN stories with dead target pages, Google Trends
// headlines that link to a search result, etc.). Searches Google News
// for the headline's title, grabs the top matching article's URL,
// follows Google's redirect, and extracts og:image from the real page.
// Not perfect (image may be thematically adjacent rather than exact)
// but consistently beats picsum for a learning-platform thumbnail.
async function fetchTopicImage(title, timeoutMs = 4000) {
  if (!title || title.length < 4) return ''
  const q = encodeURIComponent(title)
  const rssUrl = 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: { 'user-agent': BROWSER_UA, 'accept': 'application/rss+xml,application/xml,text/xml', 'accept-language': 'en-US,en;q=0.9' },
    })
    if (!res.ok) return ''
    const xml = await res.text()
    const first = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/i)
    if (!first) return ''
    // Google News RSS now ships a redirector link; fetchOgImage with
    // redirect:'follow' resolves it to the real article URL.
    const link = pickTag(first[1], 'link')
    if (!link || !/^https?:\/\//i.test(link)) return ''
    return await fetchOgImage(link, timeoutMs)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

// Fetch og:image (or twitter:image) from a target article URL. Used as
// a fallback when a source's RSS feed didn't ship an image — Google
// News search feeds, Hacker News, and TechCrunch RSS are the usual
// offenders. Capped head read + head-only match keeps this cheap.
async function fetchOgImage(url, timeoutMs = 3000) {
  if (!url || !/^https?:\/\//i.test(url)) return ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KoreHanNewsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return ''
    const ct = res.headers.get('content-type') || ''
    if (!/html/i.test(ct)) return ''
    // Read only the head slice — most og tags are in the first ~50 KB.
    const html = await res.text()
    const headSlice = (html.match(/<head[^>]*>([\s\S]{0,80000})<\/head>/i) || [null, html.slice(0, 80000)])[1]
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    ]
    for (const re of patterns) {
      const m = headSlice.match(re)
      if (m && m[1]) {
        let abs = decodeEntities(m[1].trim())
        // Resolve relative og:image against the page URL
        if (!/^https?:\/\//i.test(abs)) {
          try { abs = new URL(abs, url).toString() } catch { continue }
        }
        return abs
      }
    }
    return ''
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

async function fetchHn(source) {
  const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20', {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('upstream_not_ok')
  const json = await res.json()
  return (json?.hits || []).map((h) => ({
    title: stripHtml(h.title || h.story_title || ''),
    source: source.label,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    published_at: toIso(h.created_at),
    summary: stripHtml(h.story_text || h.comment_text || '').slice(0, 280),
    category: source.category,
    image: null,
  }))
}


// Wikinews (en + ko) — uses the MediaWiki API to fetch the most
// recently published articles plus their lead paragraph and main
// image in two HTTP calls.
//
// Wikinews content is licensed CC-BY 2.5 (and most images are
// either CC0 or CC-BY); the source URL stored on every row gives
// the admin everything they need to attribute the original
// authors when they adapt the article into a learning piece.
async function fetchWikinews(source) {
  const lang = source.lang === 'ko' ? 'ko' : 'en'
  const apiBase = `https://${lang}.wikinews.org/w/api.php`

  // 1) List the 20 most recent published articles. Wikinews convention is
  //    to drop every published story under Category:Published (en) /
  //    분류:정식기사 (ko). cmsort=timestamp + cmdir=desc puts the newest first.
  const cmTitle = lang === 'ko' ? '분류:정식기사' : 'Category:Published'
  const listUrl = `${apiBase}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cmTitle)}&cmsort=timestamp&cmdir=desc&cmlimit=20&cmprop=ids|title|timestamp&format=json&origin=*`
  const listRes = await fetch(listUrl, {
    headers: { 'user-agent': 'KoreHanNewsBot/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!listRes.ok) throw new Error('upstream_not_ok')
  const listJson = await listRes.json()
  const pages = listJson?.query?.categorymembers || []
  if (!pages.length) return []

  // 2) Batch-fetch intro extracts + main image for every page in one query.
  //    pageids is comma-separated; piprop=original gives the full-size image.
  const pageIds = pages.map((p) => p.pageid).join('|')
  const detailUrl = `${apiBase}?action=query&pageids=${pageIds}&prop=extracts|pageimages|info&exintro=1&explaintext=1&piprop=original&inprop=url&format=json&origin=*`
  const detailRes = await fetch(detailUrl, {
    headers: { 'user-agent': 'KoreHanNewsBot/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!detailRes.ok) throw new Error('upstream_not_ok')
  const detailJson = await detailRes.json()
  const detailMap = detailJson?.query?.pages || {}

  return pages.map((p) => {
    const d = detailMap[String(p.pageid)] || {}
    const summary = stripHtml(d.extract || '').slice(0, 280)
    const image = d.original?.source || d.thumbnail?.source || ''
    return {
      title: stripHtml(p.title || ''),
      source: source.label,
      url: d.fullurl || `https://${lang}.wikinews.org/wiki/${encodeURIComponent(p.title || '')}`,
      published_at: toIso(p.timestamp || ''),
      summary,
      category: source.category,
      image: image || null,
    }
  })
}

async function loadExistingDedupSet(supaUrl, headers) {
  if (!supaUrl || !headers?.authorization || !headers?.apikey) return new Set()
  try {
    const u = `${supaUrl}/rest/v1/articles?select=title,source_url,date&order=date.desc&limit=1000`
    const r = await fetch(u, { headers: { authorization: headers.authorization, apikey: headers.apikey } })
    if (!r.ok) return new Set()
    const rows = await r.json()
    const set = new Set()
    ;(rows || []).forEach((row) => {
      if (row?.title) set.add(headlineKey(row.title))
      if (row?.source_url) set.add(String(row.source_url).trim())
    })
    return set
  } catch {
    return new Set()
  }
}

function normalizeAndFilter(rows, seenDb) {
  const seen = new Set()
  const out = []
  for (const item of rows) {
    if (!item?.title || !item?.url) continue
    if (item.title.length < 8) continue
    if (!/^https?:\/\//.test(item.url)) continue
    if (!isRecent(item.published_at, 10)) continue
    const tKey = headlineKey(item.title)
    const uKey = String(item.url).trim()
    if (seenDb.has(tKey) || seenDb.has(uKey)) continue
    if (seen.has(tKey) || seen.has(uKey)) continue
    seen.add(tKey)
    seen.add(uKey)
    out.push(item)
  }
  // Order: GIF posts first (great short hero clips for learning articles),
  // then other video posts, then plain image/text posts. Within each
  // tier, newest-first by published_at.
  function tier(it) {
    if (it.is_gif) return 0
    if (it.video_url) return 1
    return 2
  }
  out.sort((a, b) => {
    const ta = tier(a), tb = tier(b)
    if (ta !== tb) return ta - tb
    return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
  })
  return out
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (request.method !== 'POST') return new Response('', { status: 405, headers: cors() })
  try {
    const body = await request.json().catch(() => ({}))
    const sourceIds = Array.isArray(body?.source_ids) ? body.source_ids : []
    const limit = Math.min(Math.max(Number(body?.limit || 50), 1), 100)

    const selected = SOURCE_CATALOG.filter((s) => sourceIds.length ? sourceIds.includes(s.id) : true)
    const supaUrl = request.headers.get('x-supabase-url') || ''
    const auth = request.headers.get('authorization') || ''
    const apikey = request.headers.get('apikey') || ''
    const dbSet = await loadExistingDedupSet(supaUrl, { authorization: auth, apikey })

    const bySource = []
    let merged = []

    await Promise.all(selected.map(async (source) => {
      try {
        let rows = []
        if (source.kind === 'rss') rows = await fetchRss(source)
        else if (source.kind === 'hn') rows = await fetchHn(source)
        else if (source.kind === 'wikinews') rows = await fetchWikinews(source)
        bySource.push({ id: source.id, label: source.label, count: rows.length })
        merged = merged.concat(rows)
      } catch (err) {
        // Surface the real reason in the JSON (visible in the admin's
        // network tab) so a recurring failure can be diagnosed without
        // redeploying — the UI still just renders "(일부 실패)".
        bySource.push({ id: source.id, label: source.label, count: 0, error: String(err?.message || err || 'unavailable') })
      }
    }))

    const items = normalizeAndFilter(merged, dbSet).slice(0, limit)

    // Second-pass: for items that still have no image (HN, Google News
    // RSS search feeds, some clickbait feeds), hit the target URL's
    // <head> and extract og:image. 8 concurrent fetches with a 3s
    // per-request timeout keeps the whole pass under ~6s even with
    // 40 targets.
    const needImage = items.filter((it) => !it.image && it.url && !it.video_url)
    if (needImage.length) {
      const concurrency = 8
      for (let i = 0; i < needImage.length; i += concurrency) {
        const slice = needImage.slice(i, i + concurrency)
        await Promise.all(slice.map(async (it) => {
          const og = await fetchOgImage(it.url)
          if (og) it.image = og
        }))
      }
    }

    // Third-pass: Google News search by title for items that STILL have
    // no image (Reddit self-posts, dead target pages, etc.). Finds an
    // adjacent-topic news article and steals its og:image. Capped at
    // 12 items and 4-concurrent so a bad batch doesn't stall the whole
    // response — anything still image-less after this falls through to
    // the picsum fallback on the frontend.
    const stillNeedImage = items.filter((it) => !it.image && it.title && !it.video_url).slice(0, 12)
    if (stillNeedImage.length) {
      const concurrency = 4
      for (let i = 0; i < stillNeedImage.length; i += concurrency) {
        const slice = stillNeedImage.slice(i, i + concurrency)
        await Promise.all(slice.map(async (it) => {
          const img = await fetchTopicImage(it.title)
          if (img) it.image = img
        }))
      }
    }

    return new Response(JSON.stringify({ ok: true, items, by_source: bySource }), {
      status: 200,
      headers: cors({ 'content-type': 'application/json' }),
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: 'SOURCE_FETCH_SERVER_ERROR' }), {
      status: 500,
      headers: cors({ 'content-type': 'application/json' }),
    })
  }
}
