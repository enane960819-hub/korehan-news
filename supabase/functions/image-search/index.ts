import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://korehani.com',
  'https://www.korehani.com',
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
]

const ADMIN_EMAILS = ['enane960819@gmail.com']

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// "Describable" filter — drop photos whose alt text is empty, generic,
// or themed around abstract / texture / pattern / minimal shots that
// have nothing for a learner to describe.
const ALT_BLOCKLIST = [
  'abstract', 'background', 'texture', 'pattern', 'wallpaper',
  'minimal', 'minimalist', 'closeup', 'close-up', 'close up',
  'gradient', 'macro shot', 'logo', 'icon', 'render',
]
function isDescribable(alt: string | null | undefined, width: number, height: number) {
  if (!alt) return false
  const a = alt.trim().toLowerCase()
  if (a.length < 20) return false
  if (ALT_BLOCKLIST.some((w) => a.includes(w))) return false
  if (width < 800 || height < 500) return false
  // landscape-ish only — square or portrait shots are awkward for the
  // study-room layout, which assumes a wide image.
  if (height > width) return false
  return true
}

const PEXELS_TIMEOUT_MS = 15_000
const MAX_PER_PAGE = 12

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey

    // Auth — admin only.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401, cors)

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!authCheck.ok) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const userData = await authCheck.json()
    if (!userData?.id) return jsonResponse({ error: 'Unauthorized' }, 401, cors)
    const isAdmin = !!(userData.email && ADMIN_EMAILS.includes(userData.email))
    if (!isAdmin) return jsonResponse({ error: 'Admin only' }, 403, cors)

    // Pexels key from app_settings.
    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const { data: setting, error: settingErr } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'pexels_key')
      .maybeSingle()
    if (settingErr) {
      console.error('[image-search] app_settings query failed:', settingErr.message)
      return jsonResponse({ error: 'Configuration unavailable' }, 503, cors)
    }
    const apiKey = setting?.value
    if (!apiKey) return jsonResponse({ error: 'pexels_key not configured in app_settings' }, 500, cors)

    // Body.
    let body: { query?: string; per_page?: number; page?: number }
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, cors)
    }
    const query = (body.query || '').trim()
    if (!query) return jsonResponse({ error: 'query required' }, 400, cors)
    const perPage = Math.min(Math.max(Number(body.per_page) || 8, 1), MAX_PER_PAGE)
    const page = Math.min(Math.max(Number(body.page) || 1, 1), 50)

    // Pexels call with timeout.
    const url = new URL('https://api.pexels.com/v1/search')
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('page', String(page))
    url.searchParams.set('orientation', 'landscape')
    url.searchParams.set('size', 'medium')

    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), PEXELS_TIMEOUT_MS)
    let pexResp: Response
    try {
      pexResp = await fetch(url.toString(), {
        headers: { 'Authorization': apiKey },
        signal: ctrl.signal,
      })
    } catch (e) {
      clearTimeout(timeoutId)
      const aborted = (e as { name?: string })?.name === 'AbortError'
      console.error('[image-search] pexels fetch failed:', aborted ? 'timeout' : (e as Error).message)
      return jsonResponse(
        { error: aborted ? 'Pexels timed out' : 'Pexels unavailable' },
        aborted ? 504 : 502,
        cors,
      )
    }
    clearTimeout(timeoutId)

    if (!pexResp.ok) {
      const txt = await pexResp.text().catch(() => '')
      console.error('[image-search] pexels non-ok:', pexResp.status, txt.slice(0, 200))
      return jsonResponse({ error: 'Pexels error', status: pexResp.status }, 502, cors)
    }

    type PexelsPhoto = {
      id: number
      width: number
      height: number
      url: string
      alt: string
      photographer: string
      photographer_url: string
      src: { large: string; medium: string; large2x?: string; original?: string }
    }
    const data = await pexResp.json() as { photos?: PexelsPhoto[]; total_results?: number }
    const photos = Array.isArray(data.photos) ? data.photos : []

    const candidates = photos
      .filter((p) => isDescribable(p.alt, p.width, p.height))
      .map((p) => ({
        id: p.id,
        width: p.width,
        height: p.height,
        alt: p.alt,
        page_url: p.url,
        photographer: p.photographer,
        photographer_url: p.photographer_url,
        thumb: p.src.medium,
        full: p.src.large2x || p.src.large || p.src.original,
      }))

    return jsonResponse({
      query,
      total: data.total_results || 0,
      returned: candidates.length,
      raw_count: photos.length,
      candidates,
    }, 200, cors)

  } catch (e) {
    console.error('[image-search] uncaught:', (e as Error).message)
    return jsonResponse({ error: (e as Error).message }, 500, cors)
  }
})
