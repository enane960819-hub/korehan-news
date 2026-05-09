// Headline sources. Korean major news outlets are intentionally excluded
// because they aggressively defend their hero-image rights; everything
// else (Reddit's public JSON, aggregator RSS, international publisher
// RSS) stays in. Source URL is preserved on every article for
// attribution.
const SOURCE_CATALOG = [
  // ── International news (publisher-provided RSS) ─────────────────
  { id:'bbc-world', label:'BBC World', kind:'rss', category:'국제', url:'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id:'bbc-tech', label:'BBC Tech', kind:'rss', category:'문화', url:'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { id:'bbc-sport', label:'BBC Sport', kind:'rss', category:'스포츠', url:'https://feeds.bbci.co.uk/sport/rss.xml' },
  { id:'npr-news', label:'NPR News', kind:'rss', category:'국제', url:'https://feeds.npr.org/1001/rss.xml' },
  { id:'reuters-world', label:'Reuters World', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en' },
  { id:'ap-top', label:'AP Top News', kind:'rss', category:'국제', url:'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en' },
  { id:'guardian-world', label:'Guardian World', kind:'rss', category:'국제', url:'https://www.theguardian.com/world/rss' },
  { id:'aljazeera', label:'Al Jazeera English', kind:'rss', category:'국제', url:'https://www.aljazeera.com/xml/rss/all.xml' },
  { id:'cnn-top', label:'CNN Top Stories', kind:'rss', category:'국제', url:'http://rss.cnn.com/rss/edition.rss' },

  // ── Tech / Trends (RSS) ─────────────────────────────────────────
  { id:'techcrunch', label:'TechCrunch', kind:'rss', category:'문화', url:'https://techcrunch.com/feed/' },
  { id:'theverge', label:'The Verge', kind:'rss', category:'문화', url:'https://www.theverge.com/rss/index.xml' },
  { id:'arstechnica', label:'Ars Technica', kind:'rss', category:'문화', url:'https://feeds.arstechnica.com/arstechnica/index' },
  { id:'wired', label:'WIRED', kind:'rss', category:'문화', url:'https://www.wired.com/feed/rss' },
  { id:'gtrends-us', label:'Google Trends US', kind:'rss', category:'국제', url:'https://trends.google.com/trending/rss?geo=US' },
  { id:'gtrends-kr', label:'Google Trends KR', kind:'rss', category:'문화', url:'https://trends.google.com/trending/rss?geo=KR' },

  // ── Lifestyle / Travel / Beauty / Food ──────────────────────────
  { id:'gn-viral', label:'Google News Viral', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=viral+trend+OR+"most+watched"&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-beauty', label:'Beauty Trends', kind:'rss', category:'beauty', url:'https://news.google.com/rss/search?q=beauty+trend+OR+skincare+OR+makeup&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-travel', label:'Travel Trends', kind:'rss', category:'travel', url:'https://news.google.com/rss/search?q=travel+trend+OR+destination+viral+OR+tourism&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-food', label:'Food Trends', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q=food+trend+OR+recipe+OR+restaurant+viral&hl=en-US&gl=US&ceid=US:en' },
  { id:'allure', label:'Allure Beauty', kind:'rss', category:'beauty', url:'https://www.allure.com/feed/rss' },
  { id:'cnet-travel', label:'CNET Travel', kind:'rss', category:'travel', url:'https://www.cnet.com/rss/news/' },
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

  // ── Reddit (public hot.json — OP-supplied media) ────────────────
  { id:'reddit-world', label:'r/worldnews', kind:'reddit', category:'국제', subreddit:'worldnews' },
  { id:'reddit-korea', label:'r/korea', kind:'reddit', category:'K-pop', subreddit:'korea' },
  { id:'reddit-kpop', label:'r/kpop', kind:'reddit', category:'K-pop', subreddit:'kpop' },
  { id:'reddit-kdrama', label:'r/KDRAMA', kind:'reddit', category:'K-pop', subreddit:'KDRAMA' },
  { id:'reddit-koreanfood', label:'r/KoreanFood', kind:'reddit', category:'문화', subreddit:'KoreanFood' },
  { id:'reddit-til', label:'r/todayilearned', kind:'reddit', category:'문화', subreddit:'todayilearned' },
  { id:'reddit-interesting', label:'r/interestingasfuck', kind:'reddit', category:'문화', subreddit:'interestingasfuck' },
  { id:'reddit-oddly', label:'r/oddlysatisfying', kind:'reddit', category:'문화', subreddit:'oddlysatisfying' },
  { id:'reddit-noway', label:'r/Damnthatsinteresting', kind:'reddit', category:'문화', subreddit:'Damnthatsinteresting' },
  { id:'reddit-mildly', label:'r/mildlyinteresting', kind:'reddit', category:'문화', subreddit:'mildlyinteresting' },
  // GIF-rich subs — silent looping clips make great learning-article
  // hero media; the picker bumps these to the top.
  { id:'reddit-edugif', label:'r/educationalgifs', kind:'reddit', category:'문화', subreddit:'educationalgifs' },
  { id:'reddit-aww', label:'r/aww', kind:'reddit', category:'문화', subreddit:'aww' },
  { id:'reddit-awwduc', label:'r/Awwducational', kind:'reddit', category:'문화', subreddit:'Awwducational' },
  { id:'reddit-mademesmile', label:'r/MadeMeSmile', kind:'reddit', category:'문화', subreddit:'MadeMeSmile' },
  { id:'reddit-bros', label:'r/HumansBeingBros', kind:'reddit', category:'문화', subreddit:'HumansBeingBros' },
  { id:'reddit-magic', label:'r/blackmagicfuckery', kind:'reddit', category:'문화', subreddit:'blackmagicfuckery' },
  { id:'reddit-sports', label:'r/sports', kind:'reddit', category:'스포츠', subreddit:'sports' },
  // Clickbait / Viral RSS aggregators
  { id:'gn-clickbait', label:'Viral Clickbait', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q="you+won\'t+believe"+OR+"shocking"+OR+"mind-blowing"+OR+"goes+viral"&hl=en-US&gl=US&ceid=US:en' },
  { id:'gn-listicle', label:'Listicles', kind:'rss', category:'문화', url:'https://news.google.com/rss/search?q="top+10"+OR+"best+of"+OR+"things+you+didn\'t+know"+OR+"reasons+why"&hl=en-US&gl=US&ceid=US:en' },
  { id:'boredpanda', label:'BoredPanda', kind:'rss', category:'문화', url:'https://www.boredpanda.com/feed/' },
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
      headers: { 'user-agent': 'KoreHanNewsBot/1.0', 'accept': 'application/rss+xml,application/xml,text/xml' },
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
    // For video posts, prefer the permalink (reddit.com/r/.../comments/ID/)
    // over d.url (which is the bare v.redd.it/VIDEOID for hosted videos).
    // The permalink is what the 'Upgrade to Reddit embed' admin action
    // converts into a redditmedia.com embed URL — keeping source_url on
    // the permalink makes that conversion a pure string rewrite.
    const permalink = d.permalink ? 'https://www.reddit.com' + d.permalink : ''
    const sourceUrl = d.is_video && permalink ? permalink : (d.url || permalink)
    return {
      title: stripHtml(d.title || ''),
      source: source.label,
      url: sourceUrl,
      published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : '',
      summary: stripHtml(d.selftext || '').slice(0, 280),
      category: source.category,
      image: extractRedditImage(d),
      video_url: video.url,
      video_kind: video.kind,
      video_fallback_url: video.fallback || '',
      // Hints for the admin headline picker — surfaces a "GIF" badge and
      // lets the picker rank GIFs higher (silent short loops make great
      // learning-article heroes and the user wants more of them).
      is_gif: video.is_gif === true,
      video_duration: video.duration || 0,
    }
  })
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
  const listRes = await fetch(listUrl, { headers: { 'user-agent': 'KoreHanNewsBot/1.0' } })
  if (!listRes.ok) throw new Error('upstream_not_ok')
  const listJson = await listRes.json()
  const pages = listJson?.query?.categorymembers || []
  if (!pages.length) return []

  // 2) Batch-fetch intro extracts + main image for every page in one query.
  //    pageids is comma-separated; piprop=original gives the full-size image.
  const pageIds = pages.map((p) => p.pageid).join('|')
  const detailUrl = `${apiBase}?action=query&pageids=${pageIds}&prop=extracts|pageimages|info&exintro=1&explaintext=1&piprop=original&inprop=url&format=json&origin=*`
  const detailRes = await fetch(detailUrl, { headers: { 'user-agent': 'KoreHanNewsBot/1.0' } })
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

// Pull a usable full-size image out of a Reddit post. Priority:
//   1. Direct i.redd.it URL (post_hint='image' or d.url ends in an image
//      extension) — these are stable, public, CORS-friendly.
//   2. preview.images[0].source.url — larger than d.thumbnail, but comes
//      HTML-escaped with signed query params. Unescape before returning.
//   3. d.thumbnail — fall back if it's a full URL.
// Skips self posts (no usable image) and gallery posts (multiple images,
// too complex here). Video posts (Reddit-hosted MP4 / GIFs that Reddit
// converts to silent loops) used to be skipped entirely, which meant
// every GIF-source article ended up with no hero. Now we still grab the
// preview image as a static fallback poster — admin can flip on
// `use_video` to play the real GIF, and otherwise readers see the
// snapshot instead of an empty hero slot.
function extractRedditImage(d) {
  if (!d || d.is_self || d.is_gallery) return null
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
// Pull a playable video out of a Reddit post. Two strategies:
//   1. Reddit hosted video (is_video) — use Reddit's own iframe embed
//      (redditmedia.com) rather than scraping HLS/MP4 tracks ourselves.
//      Their player handles audio/video muxing, codec quirks, CORS,
//      signed URL expiry, and mobile platform differences out of the
//      box. Downside is a small bit of Reddit branding inside the
//      frame; upside is it Just Works on every device we care about.
//   2. YouTube cross-post — our own privacy-friendly youtube-nocookie
//      embed (d.url is the youtube.com / youtu.be link).
// Returns {url, kind, fallback, is_gif, duration} where kind is:
//   'reddit-hls' | 'youtube' | '' (nothing usable)
//
// Duration cap: short-form video only (MAX_VIDEO_SECONDS = 90). Anything
// longer is rejected during ingest. is_gif comes through as a hint —
// silent looping clips are great hero media for a learning article and
// the picker uses it to bubble those headlines higher.
const MAX_VIDEO_SECONDS = 90
function extractRedditVideo(d) {
  if (d?.is_video) {
    const rv =
      d?.media?.reddit_video ||
      d?.secure_media?.reddit_video ||
      d?.crosspost_parent_list?.[0]?.media?.reddit_video ||
      d?.preview?.reddit_video_preview ||
      null
    const duration = Number(rv?.duration || 0)
    if (rv && duration > MAX_VIDEO_SECONDS) {
      return { url: '', kind: '', fallback: '', is_gif: false, duration: 0 }
    }
    const hls = rv?.hls_url || ''
    const mp4 = rv?.fallback_url || ''
    if (hls || mp4) {
      return {
        url: hls || mp4,
        kind: 'reddit-hls',
        fallback: hls ? mp4 : '',
        is_gif: rv?.is_gif === true,
        duration: duration,
      }
    }
  }
  const url = d?.url_overridden_by_dest || d?.url || ''
  const ytId = extractYoutubeId(url)
  if (ytId) return { url: 'https://www.youtube-nocookie.com/embed/' + ytId, kind: 'youtube', fallback: '', is_gif: false, duration: 0 }
  const oembedHtml = d?.secure_media?.oembed?.html || d?.media?.oembed?.html || ''
  if (oembedHtml) {
    const srcMatch = oembedHtml.match(/src="([^"]+)"/i)
    const ytId2 = srcMatch ? extractYoutubeId(srcMatch[1]) : ''
    if (ytId2) return { url: 'https://www.youtube-nocookie.com/embed/' + ytId2, kind: 'youtube', fallback: '', is_gif: false, duration: 0 }
  }
  return { url: '', kind: '', fallback: '', is_gif: false, duration: 0 }
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
        else if (source.kind === 'reddit') rows = await fetchReddit(source)
        else if (source.kind === 'wikinews') rows = await fetchWikinews(source)
        bySource.push({ id: source.id, label: source.label, count: rows.length })
        merged = merged.concat(rows)
      } catch {
        bySource.push({ id: source.id, label: source.label, count: 0, error: 'unavailable' })
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
