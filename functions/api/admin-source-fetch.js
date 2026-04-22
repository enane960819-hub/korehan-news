const SOURCE_CATALOG = [
  { id:'yonhap', label:'연합뉴스', kind:'rss', category:'사회', url:'https://www.yna.co.kr/rss/news.xml' },
  { id:'bbc-world', label:'BBC World', kind:'rss', category:'국제', url:'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id:'bbc-tech', label:'BBC Tech', kind:'rss', category:'문화', url:'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id:'techcrunch', label:'TechCrunch', kind:'rss', category:'문화', url:'https://techcrunch.com/feed/' },
  { id:'gtrends-us', label:'Google Trends US', kind:'rss', category:'국제', url:'https://trends.google.com/trending/rss?geo=US' },
  { id:'gn-viral', label:'Google News Viral', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=viral+trend+OR+"most+watched"&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-beauty', label:'Beauty Trends', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=beauty+trend+OR+skincare+OR+makeup&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-travel', label:'Travel Trends', kind:'rss', category:'travel', url:'https://news.google.com/rss/search?q=travel+trend+OR+destination+viral+OR+tourism&hl=en-US&gl=US&ceid=US:en' },
  { id:'allure', label:'Allure Beauty', kind:'rss', category:'beauty', url:'https://www.allure.com/feed/rss' },
  { id:'cnet-travel', label:'CNET Travel', kind:'rss', category:'travel', url:'https://www.cnet.com/rss/news/' },
  { id:'hn', label:'Hacker News', kind:'hn', category:'문화' },
  { id:'reddit-world', label:'r/worldnews', kind:'reddit', category:'국제', subreddit:'worldnews' },
  { id:'reddit-korea', label:'r/korea', kind:'reddit', category:'K-pop', subreddit:'korea' },
  { id:'reddit-kpop', label:'r/kpop', kind:'reddit', category:'K-pop', subreddit:'kpop' },
  // Clickbait / Viral
  { id:'reddit-til', label:'r/todayilearned', kind:'reddit', category:'문화', subreddit:'todayilearned' },
  { id:'reddit-interesting', label:'r/interestingasfuck', kind:'reddit', category:'문화', subreddit:'interestingasfuck' },
  { id:'reddit-oddly', label:'r/oddlysatisfying', kind:'reddit', category:'문화', subreddit:'oddlysatisfying' },
  { id:'reddit-noway', label:'r/Damnthatsinteresting', kind:'reddit', category:'문화', subreddit:'Damnthatsinteresting' },
  { id:'gn-clickbait', label:'Viral Clickbait', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q="you+won\'t+believe"+OR+"shocking"+OR+"mind-blowing"+OR+"goes+viral"&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-listicle', label:'Listicles', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q="top+10"+OR+"best+of"+OR+"things+you+didn\'t+know"+OR+"reasons+why"&hl=en-US&gl=US&ceid=US:en' },
  { id:'boredpanda', label:'BoredPanda', kind:'rss', category:'문화', url:'https://www.boredpanda.com/feed/' },
  { id:'reddit-mildly', label:'r/mildlyinteresting', kind:'reddit', category:'문화', subreddit:'mildlyinteresting' },
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
  const res = await fetch(source.url, { headers: { 'user-agent': 'KoreHanNewsBot/1.0' } })
  if (!res.ok) throw new Error('upstream_not_ok')
  const xml = await res.text()
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  return itemMatches.slice(0, 20).map((block) => {
    const title = pickTag(block, 'title')
    const summary = pickTag(block, 'description') || pickTag(block, 'summary') || pickTag(block, 'content')
    const url = pickTag(block, 'link') || pickAttr(block, 'link', 'href')
    const published_at = toIso(pickTag(block, 'pubDate') || pickTag(block, 'published') || pickTag(block, 'updated'))
    const image = pickTag(block, 'media:thumbnail') || pickTag(block, 'media:content')
    return {
      title,
      source: source.label,
      url,
      published_at,
      summary: summary.slice(0, 280),
      category: source.category,
      image: image || null,
    }
  })
}

async function fetchHn(source) {
  const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20')
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

async function fetchReddit(source) {
  const res = await fetch(`https://www.reddit.com/r/${source.subreddit}/hot.json?limit=20`, {
    headers: { 'user-agent': 'KoreHanNewsBot/1.0' }
  })
  if (!res.ok) throw new Error('upstream_not_ok')
  const json = await res.json()
  return (json?.data?.children || []).map((c) => {
    const d = c?.data || {}
    const video = extractRedditVideo(d)
    return {
      title: stripHtml(d.title || ''),
      source: source.label,
      url: d.url || ('https://www.reddit.com' + (d.permalink || '')),
      published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : '',
      summary: stripHtml(d.selftext || '').slice(0, 280),
      category: source.category,
      image: extractRedditImage(d),
      video_url: video.url,
      video_kind: video.kind,
    }
  })
}

// Pull a usable full-size image out of a Reddit post. Priority:
//   1. Direct i.redd.it URL (post_hint='image' or d.url ends in an image
//      extension) — these are stable, public, CORS-friendly.
//   2. preview.images[0].source.url — larger than d.thumbnail, but comes
//      HTML-escaped with signed query params. Unescape before returning.
//   3. d.thumbnail — fall back if it's a full URL.
// Skips videos entirely (image means "still image hero"); skips self posts
// (no usable image) and gallery posts (multiple images, too complex here).
function extractRedditImage(d) {
  if (!d || d.is_video || d.is_self || d.is_gallery) return null
  if (d.url && /^https?:\/\/i\.redd\.it\//.test(d.url)) return d.url
  if (d.url && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(d.url)) return d.url
  const preview = d?.preview?.images?.[0]?.source?.url
  if (preview) return decodeEntities(String(preview))
  if (d.thumbnail && /^https?:\/\//.test(d.thumbnail) && d.thumbnail !== 'self') return d.thumbnail
  return null
}

// Pull a playable video out of a Reddit post record. We prefer formats
// that carry audio alongside video:
//   1. Self-hosted v.redd.it — Reddit stores video and audio on separate
//      tracks. The fallback_url MP4 is video-only (silent), but hls_url is
//      an HLS manifest (.m3u8) that multiplexes both. We return the HLS URL
//      under kind 'reddit-hls' so the frontend can play it with hls.js
//      (or native HLS on Safari). fallback_url is kept as a last resort
//      under kind 'reddit' — silent, but better than nothing.
//   2. YouTube cross-post — embed URL, always carries audio.
// Returns {url:'', kind:''} when nothing usable is found.
function extractRedditVideo(d) {
  const rv = d?.secure_media?.reddit_video || d?.media?.reddit_video
  if (d?.is_video && rv?.hls_url) {
    return { url: String(rv.hls_url), kind: 'reddit-hls' }
  }
  if (d?.is_video && rv?.fallback_url) {
    return { url: String(rv.fallback_url), kind: 'reddit' }
  }
  const url = d?.url_overridden_by_dest || d?.url || ''
  const ytId = extractYoutubeId(url)
  if (ytId) return { url: 'https://www.youtube-nocookie.com/embed/' + ytId, kind: 'youtube' }
  // secure_media.oembed.html sometimes carries a YouTube iframe for link posts
  // that point at non-youtube domains but embed youtube (rare but cheap to try).
  const oembedHtml = d?.secure_media?.oembed?.html || d?.media?.oembed?.html || ''
  if (oembedHtml) {
    const srcMatch = oembedHtml.match(/src="([^"]+)"/i)
    const ytId2 = srcMatch ? extractYoutubeId(srcMatch[1]) : ''
    if (ytId2) return { url: 'https://www.youtube-nocookie.com/embed/' + ytId2, kind: 'youtube' }
  }
  return { url: '', kind: '' }
}

function extractYoutubeId(url) {
  if (!url || typeof url !== 'string') return ''
  // youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID,
  // youtube.com/shorts/ID, youtube-nocookie.com/embed/ID
  const m = url.match(/(?:youtube\.com\/(?:watch\?[^#]*\bv=|embed\/|shorts\/|v\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
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
  out.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
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
        else if (source.kind === 'reddit') rows = await fetchReddit(source)
        bySource.push({ id: source.id, label: source.label, count: rows.length })
        merged = merged.concat(rows)
      } catch {
        bySource.push({ id: source.id, label: source.label, count: 0, error: 'unavailable' })
      }
    }))

    const items = normalizeAndFilter(merged, dbSet).slice(0, limit)
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
