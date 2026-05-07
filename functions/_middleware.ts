/**
 * Cloudflare Pages middleware: gate the admin CMS behind HTTP Basic
 * Auth before the static `korehan-x9f4k2m7.html` is served. Without
 * this, the obscured URL was the only barrier — anyone who knew or
 * guessed the path could load the page, see the CMS UI in source,
 * and try crafting RPC calls. The Supabase admin-api still gates by
 * email + service-role JWT, so even if Basic Auth were bypassed the
 * RPCs would 403, but we want defense-in-depth and to keep the CMS
 * markup itself out of view.
 *
 * Required Cloudflare Pages env vars (set in dashboard):
 *   ADMIN_BASIC_USER   default: admin
 *   ADMIN_BASIC_PASS   no default — REQUIRED
 *
 * Path patterns gated:
 *   /korehan-x9f4k2m7.html
 *   /korehan-x9f4k2m7-phrases.html
 *   /korehan-tutor-7v3ca.html  (tutor admin shell)
 *
 * Everything else falls through to the next handler / static file.
 */
type Env = {
  ADMIN_BASIC_USER?: string
  ADMIN_BASIC_PASS?: string
}

const PROTECTED_PATHS = [
  '/korehan-x9f4k2m7.html',
  '/korehan-x9f4k2m7-phrases.html',
  '/korehan-tutor-7v3ca.html',
]

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function challenge(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="KoreHani Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname

  // Only gate the admin paths; everything else passes through.
  if (!PROTECTED_PATHS.includes(path)) {
    return context.next()
  }

  const expectedUser = context.env.ADMIN_BASIC_USER || 'admin'
  const expectedPass = context.env.ADMIN_BASIC_PASS
  // If the env var isn't set, fail closed — better to show the
  // challenge than to silently leave the admin open because the
  // dashboard config wasn't applied.
  if (!expectedPass) return challenge()

  const auth = context.request.headers.get('Authorization') || ''
  if (!auth.startsWith('Basic ')) return challenge()

  let decoded = ''
  try { decoded = atob(auth.slice(6)) } catch { return challenge() }
  const sep = decoded.indexOf(':')
  if (sep < 0) return challenge()
  const user = decoded.slice(0, sep)
  const pass = decoded.slice(sep + 1)

  if (!timingSafeEqual(user, expectedUser) || !timingSafeEqual(pass, expectedPass)) {
    return challenge()
  }

  // Authenticated — let the static file render.
  return context.next()
}
