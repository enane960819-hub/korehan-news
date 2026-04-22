// Reverse-lookup a Reddit post permalink from a v.redd.it video URL.
//
// Use case: legacy article rows were saved with source_url =
// 'https://v.redd.it/VIDEOID' (the bare hosted-video URL) and video_kind
// of 'reddit' or 'reddit-hls'. To upgrade them to the reliable
// 'reddit-embed' path we need the post permalink
// ('/r/sub/comments/POSTID/slug/'), which isn't in what we already
// stored. Reddit's /api/info endpoint takes a URL and returns any
// posts whose URL matches, so we can hit that server-side (avoids
// CORS and keeps request volume trackable).
//
// POST body:
//   { video_ids: ['VIDEOID', ...] }
//
// Response:
//   { ok: true, map: { VIDEOID: { permalink: 'https://...', subreddit, title } }, misses: ['VIDEOID2', ...] }

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'content-type': 'application/json',
    ...extra,
  }
}

async function lookupOne(videoId) {
  const target = 'https://v.redd.it/' + encodeURIComponent(videoId)
  // /api/info?url=... — Reddit's own endpoint, returns the listing for
  // any post whose stored URL matches. Works server-side without auth.
  const res = await fetch(
    'https://api.reddit.com/api/info?url=' + encodeURIComponent(target),
    { headers: { 'User-Agent': 'KoreHanNewsBot/1.0' } }
  )
  if (!res.ok) return null
  const json = await res.json()
  const child = json?.data?.children?.[0]?.data
  if (!child || !child.permalink) return null
  return {
    permalink: 'https://www.reddit.com' + child.permalink,
    subreddit: child.subreddit || '',
    title: child.title || '',
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors() })
  let body = {}
  try { body = await request.json() } catch {}
  const ids = Array.isArray(body.video_ids) ? body.video_ids.filter(Boolean).slice(0, 40) : []
  if (!ids.length) {
    return new Response(JSON.stringify({ ok: false, message: 'no video_ids' }), { status: 400, headers: cors() })
  }
  const map = {}
  const misses = []
  // Reddit's API tolerates a few parallel requests but rate-limits at
  // burst. Cap at 4 concurrent to stay friendly.
  const chunk = 4
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    const results = await Promise.all(slice.map(async (id) => {
      try { return [id, await lookupOne(id)] } catch { return [id, null] }
    }))
    for (const [id, hit] of results) {
      if (hit) map[id] = hit
      else misses.push(id)
    }
  }
  return new Response(JSON.stringify({ ok: true, map, misses }), { status: 200, headers: cors() })
}
