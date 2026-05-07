// Just-in-time resolver for Reddit hosted videos.
//
// Why this exists: Reddit's v.redd.it CDN serves signed HLS / DASH URLs
// that expire after a few hours. We persist the URL at article-creation
// time, so a viewer arriving days later gets 403 on the manifest, and
// the player degrades to silent MP4 — losing audio.
//
// This function takes the Reddit POST permalink (which never expires)
// and returns a fresh set of playback URLs by hitting Reddit's public
// JSON API. The frontend calls this right before initialising the
// player so the URLs are guaranteed unexpired at the moment of playback.
//
// Input (POST JSON):
//   { permalink: 'https://www.reddit.com/r/sub/comments/ID/slug/' }
//   - or - { video_id: 'V_REDD_IT_ID' }   (legacy fallback)
//
// Response:
//   {
//     ok: true,
//     hls_url:    'https://v.redd.it/.../HLSPlaylist.m3u8?...'  // muxed
//     video_url:  'https://v.redd.it/.../DASH_720.mp4?source=fallback' // silent
//     audio_url:  'https://v.redd.it/.../DASH_AUDIO_128.mp4'    // audio-only, may 404 on truly silent posts
//     dash_url:   'https://v.redd.it/.../DASHPlaylist.mpd'      // for completeness
//     has_audio:  true|false                                    // best-effort guess
//   }
//
// Caching: response is Cache-Control'd so Cloudflare's edge cache absorbs
// repeat hits within the freshness window. We don't run our own KV cache
// — Cloudflare's HTTP cache is sufficient and zero-config.

const REDDIT_UA = 'KoreHanNewsBot/1.0 (+https://korehani.com)'

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'content-type': 'application/json',
    ...extra,
  }
}

function normalisePermalink(input) {
  if (!input || typeof input !== 'string') return ''
  // Accept full URL or relative '/r/sub/comments/ID/...'.
  let url = input.trim()
  if (url.startsWith('/r/')) url = 'https://www.reddit.com' + url
  const m = url.match(/^https?:\/\/(?:www\.|old\.|new\.)?reddit\.com(\/r\/[^?#]+\/comments\/[^?#]+)/i)
  if (!m) return ''
  let path = m[1]
  if (!path.endsWith('/')) path += '/'
  return 'https://www.reddit.com' + path
}

async function fetchPostJson(permalink) {
  // .json suffix on the permalink returns the post + comments listing
  // without auth. We only need the post (first listing, first child).
  const url = permalink.replace(/\/$/, '') + '.json?raw_json=1&limit=1'
  const res = await fetch(url, {
    headers: { 'User-Agent': REDDIT_UA, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error('reddit fetch failed: ' + res.status)
  const json = await res.json()
  const post = json?.[0]?.data?.children?.[0]?.data
  if (!post) throw new Error('post data not found in response')
  return post
}

async function permalinkFromVideoId(videoId) {
  const target = 'https://v.redd.it/' + encodeURIComponent(videoId)
  const res = await fetch(
    'https://api.reddit.com/api/info?url=' + encodeURIComponent(target),
    { headers: { 'User-Agent': REDDIT_UA } }
  )
  if (!res.ok) throw new Error('info lookup failed: ' + res.status)
  const json = await res.json()
  const child = json?.data?.children?.[0]?.data
  if (!child?.permalink) throw new Error('no permalink for video id')
  return 'https://www.reddit.com' + child.permalink
}

function deriveAudioUrl(hlsOrDashUrl) {
  // v.redd.it stores tracks as siblings under /{ID}/. The audio track is
  // most commonly DASH_AUDIO_128.mp4 (older posts use audio.mp4). We
  // derive from the manifest URL because the post JSON doesn't list
  // it directly — Reddit's media object only exposes the muxed manifests.
  if (!hlsOrDashUrl) return ''
  const m = String(hlsOrDashUrl).match(/^(https?:\/\/v\.redd\.it\/[^/?#]+)\//)
  if (!m) return ''
  return m[1] + '/DASH_AUDIO_128.mp4'
}

function extractMedia(post) {
  // Reddit exposes hosted video metadata in two places depending on the
  // post type (link vs crosspost). reddit_video lives under media for
  // direct posts, and under crosspost_parent_list[0].media for shares.
  const rv =
    post?.media?.reddit_video ||
    post?.secure_media?.reddit_video ||
    post?.crosspost_parent_list?.[0]?.media?.reddit_video ||
    post?.preview?.reddit_video_preview ||
    null
  if (!rv) return null
  // is_gif === true means there's no audio track at all (Reddit's flag
  // for truly silent/GIF posts). For everything else we assume audio
  // exists and let the client handle the audio fetch failing gracefully.
  const hasAudio = rv.is_gif === false || rv.has_audio === true || (!rv.is_gif && !!rv.hls_url)
  return {
    hls_url: rv.hls_url || '',
    dash_url: rv.dash_url || '',
    video_url: rv.fallback_url || '',  // silent MP4
    audio_url: hasAudio ? deriveAudioUrl(rv.hls_url || rv.dash_url || rv.fallback_url) : '',
    has_audio: hasAudio,
    duration: Number(rv.duration || 0),
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, message: 'method not allowed' }), {
      status: 405, headers: cors(),
    })
  }

  let body = {}
  try { body = await request.json() } catch {}

  let permalink = normalisePermalink(body.permalink || '')
  if (!permalink && body.video_id) {
    try { permalink = await permalinkFromVideoId(String(body.video_id)) }
    catch (e) {
      return new Response(JSON.stringify({ ok: false, message: 'video_id lookup failed: ' + (e.message || '') }), {
        status: 404, headers: cors(),
      })
    }
  }
  if (!permalink) {
    return new Response(JSON.stringify({ ok: false, message: 'permalink or video_id required' }), {
      status: 400, headers: cors(),
    })
  }

  let post
  try { post = await fetchPostJson(permalink) }
  catch (e) {
    return new Response(JSON.stringify({ ok: false, message: 'reddit fetch failed: ' + (e.message || '') }), {
      status: 502, headers: cors(),
    })
  }

  const media = extractMedia(post)
  if (!media) {
    return new Response(JSON.stringify({ ok: false, message: 'no reddit_video media in post' }), {
      status: 404, headers: cors(),
    })
  }

  // Cache at the edge for 30 minutes. Reddit's signed URLs typically
  // outlast that window, so the cache hit is always usable, and a
  // cache MISS just re-runs the same cheap fetch. We deliberately do
  // not cache the raw 4xx errors above — those should retry naturally.
  return new Response(JSON.stringify({ ok: true, permalink, ...media }), {
    status: 200,
    headers: cors({
      'cache-control': 'public, max-age=1800, s-maxage=1800',
    }),
  })
}
