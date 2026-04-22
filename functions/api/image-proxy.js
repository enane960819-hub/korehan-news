// Image byte proxy for admin-triggered persistence.
//
// The admin panel uses _seDirectUpload() to push blobs into Supabase
// storage with the anon key, but it can't fetch the source image
// cross-origin first — most news-site CDNs don't send
// Access-Control-Allow-Origin, so browser fetch() for the image bytes
// hits a CORS wall. This function re-fetches the image server-side
// and serves the bytes back same-origin so the admin code can
// pipeline fetch → blob → Supabase upload without touching the
// external host directly from the browser.
//
// Hardening:
//   - GET/HEAD only
//   - content-type must start with image/
//   - soft cap at 8 MB (Reddit galleries and hi-res news photos land
//     well under 2 MB in practice)
//   - no upstream cookies forwarded; plain UA only

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'accept,range',
    ...extra,
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors() })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: cors() })
  }
  const reqUrl = new URL(request.url)
  const target = reqUrl.searchParams.get('url')
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response('bad url', { status: 400, headers: cors({ 'content-type': 'text/plain' }) })
  }

  let upstream
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KoreHanNewsBot/1.0)', Accept: 'image/*' },
      redirect: 'follow',
    })
  } catch (e) {
    return new Response('upstream fetch failed: ' + (e && e.message || ''), {
      status: 502,
      headers: cors({ 'content-type': 'text/plain' }),
    })
  }
  if (!upstream.ok) {
    return new Response('upstream not ok: ' + upstream.status, {
      status: 502,
      headers: cors({ 'content-type': 'text/plain' }),
    })
  }
  const ct = upstream.headers.get('content-type') || ''
  if (!/^image\//i.test(ct)) {
    return new Response('not an image (got ' + ct + ')', {
      status: 415,
      headers: cors({ 'content-type': 'text/plain' }),
    })
  }
  const cl = parseInt(upstream.headers.get('content-length') || '0', 10)
  if (cl && cl > 8 * 1024 * 1024) {
    return new Response('image too large: ' + cl, {
      status: 413,
      headers: cors({ 'content-type': 'text/plain' }),
    })
  }

  const headers = cors({
    'content-type': ct,
    'cache-control': 'public, max-age=86400',
  })
  if (cl) headers['content-length'] = String(cl)
  return new Response(upstream.body, { status: 200, headers })
}
