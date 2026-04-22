// HLS proxy for Reddit hosted videos.
//
// Why this exists: v.redd.it serves HLS manifests and segments with
// inconsistent CORS across clients. Desktop Chrome tolerates it; Android
// Chrome, Samsung Internet, and some iOS Safari builds flat-out reject
// the cross-origin fetch or stall silently in hls.js, leaving the admin's
// audio-bearing HLS playback broken on exactly the devices most users
// browse from.
//
// By routing the manifest + segments through our own origin, the browser
// sees same-origin responses, CORS is a non-issue, and hls.js behaves the
// same on mobile as it does on desktop — so Reddit videos keep their
// audio on phones too.
//
// Security:
//   - Targets are strictly whitelisted to Reddit CDN hostnames. Anyone
//     pinging /api/hls-proxy?url=... with a different origin gets 403,
//     so this can't be weaponised as an open proxy.
//   - Manifest rewriting only rewrites URLs whose ORIGIN (scheme+host)
//     is in the whitelist; arbitrary #EXT lines are untouched.
//
// Bandwidth:
//   - Reddit HLS segments are ~200–800 KB each for a typical 15–30s
//     clip (3–6 segments + one audio track). A handful of KoreHan
//     visitors per article stays well inside the Cloudflare Pages
//     Functions free tier; if that changes we'll move to a signed
//     Supabase storage mux instead.

const ALLOWED_HOSTS = new Set([
  'v.redd.it',
  'packaged-media.redd.it',
  'dash.redd.it',
])

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'range,accept,origin',
    'Access-Control-Expose-Headers': 'content-length,content-range,accept-ranges',
    ...extra,
  }
}

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    return ALLOWED_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

function selfProxyUrl(requestUrl, targetUrl) {
  // Build an absolute same-origin URL pointing back at this function so
  // manifest lines can be drop-in replaced.
  const req = new URL(requestUrl)
  return req.origin + '/api/hls-proxy?url=' + encodeURIComponent(targetUrl)
}

function rewriteManifest(text, baseUrl, requestUrl) {
  const base = new URL(baseUrl)
  const lines = text.split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Blank lines pass through.
    if (!line.trim()) { out.push(line); continue }
    // Playlist directives (#EXTM3U, #EXTINF, etc.). Most are untouched,
    // but a few carry URIs in attributes we must rewrite.
    if (line.startsWith('#')) {
      out.push(line.replace(/URI="([^"]+)"/g, (m, uri) => {
        const abs = /^https?:\/\//i.test(uri) ? uri : new URL(uri, base).toString()
        if (!isAllowed(abs)) return m
        return 'URI="' + selfProxyUrl(requestUrl, abs) + '"'
      }))
      continue
    }
    // Non-comment lines are segment / variant URIs.
    const abs = /^https?:\/\//i.test(line) ? line : new URL(line, base).toString()
    if (!isAllowed(abs)) { out.push(line); continue }
    out.push(selfProxyUrl(requestUrl, abs))
  }
  return out.join('\n')
}

function looksLikeManifest(url, contentType) {
  if (/\.m3u8(\?|$)/i.test(url)) return true
  if (contentType && /mpegurl|m3u8/i.test(contentType)) return true
  return false
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors() })
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: cors() })
  }

  const reqUrl = new URL(request.url)
  const target = reqUrl.searchParams.get('url')
  if (!target) {
    return new Response('missing url parameter', { status: 400, headers: cors() })
  }
  if (!isAllowed(target)) {
    return new Response('host not allowed', { status: 403, headers: cors() })
  }

  // Forward the client's Range header so video scrubbing works without
  // downloading entire segments — Reddit segments honor byte ranges.
  const fwdHeaders = { 'User-Agent': 'KoreHanHlsProxy/1.0' }
  const rangeHeader = request.headers.get('range')
  if (rangeHeader) fwdHeaders['Range'] = rangeHeader
  const accept = request.headers.get('accept')
  if (accept) fwdHeaders['Accept'] = accept

  let upstream
  try {
    upstream = await fetch(target, { method: request.method, headers: fwdHeaders, redirect: 'follow' })
  } catch (e) {
    return new Response('upstream fetch failed: ' + (e && e.message || ''), {
      status: 502,
      headers: cors({ 'content-type': 'text/plain' }),
    })
  }

  const upstreamType = upstream.headers.get('content-type') || ''

  // Manifest: rewrite URIs so segments come back through us too. Small
  // text response, fine to buffer.
  if (request.method === 'GET' && looksLikeManifest(target, upstreamType)) {
    const text = await upstream.text()
    const rewritten = rewriteManifest(text, target, request.url)
    return new Response(rewritten, {
      status: upstream.status,
      headers: cors({
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': 'no-cache',
      }),
    })
  }

  // Segment or sub-resource: stream the bytes through, preserving the
  // status (206 for Range, etc.) and content headers hls.js needs.
  const passHeaders = cors({
    'content-type': upstreamType || 'application/octet-stream',
  })
  const passthrough = ['content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']
  for (const h of passthrough) {
    const v = upstream.headers.get(h)
    if (v) passHeaders[h] = v
  }
  if (!passHeaders['cache-control']) passHeaders['cache-control'] = 'public, max-age=3600'
  return new Response(upstream.body, { status: upstream.status, headers: passHeaders })
}
