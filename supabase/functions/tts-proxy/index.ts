/**
 * TTS Proxy — Korean neural pronunciation
 * Voices: ko-KR-SunHiNeural (female), ko-KR-InJoonNeural (male)
 *
 * Engine: the official Azure Speech REST API. Set the function secrets
 * AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (the free F0 tier covers 0.5M
 * neural characters a month). Without them the function answers 503
 * right away so clients fall back to the device voice instead of waiting.
 * (The old unofficial Edge read-aloud socket stopped accepting requests.)
 *
 * Every clip is stored once in the public `tts-cache` bucket at
 * <voice>/<sha256(voice|text)>.mp3 — clients read that URL first, so a
 * word is synthesized once for everyone, not on every tap.
 */

const VOICE_MAP: Record<string, string> = {
  female: 'ko-KR-SunHiNeural',
  male: 'ko-KR-InJoonNeural',
}

const ALLOWED_ORIGINS = [
  'https://korehani.com',
  'https://www.korehani.com',
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function synthesize(text: string, voiceName: string, key: string, region: string): Promise<Uint8Array> {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR"><voice name="${voiceName}">${escapeXml(text)}</voice></speak>`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'korehani-tts-proxy',
      },
      body: ssml,
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error('azure_' + r.status)
    return new Uint8Array(await r.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Without JWT verification any caller could drive unlimited
    // synthesis through this function (billed characters + Edge
    // Function CPU). The 500-char cap below is only useful AFTER we've
    // already established that the caller is a logged-in user.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Do NOT fall back to SUPABASE_SERVICE_ROLE_KEY here — leaking the
    // service-role key to /auth/v1/user as the `apikey` header would
    // surface in intermediate proxy / CDN access logs. If anon key is
    // unset (project re-provisioned, typo, env wipe), fail loud so the
    // operator sees the 500 instead of silently authenticating with
    // service-role privileges.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!anonKey) {
      console.error('[tts-proxy] SUPABASE_ANON_KEY missing')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': anonKey },
    })
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const text = String(body.text || '').slice(0, 500)
    if (!text) {
      return new Response(JSON.stringify({ error: 'no text' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const azureKey = Deno.env.get('AZURE_SPEECH_KEY')
    const azureRegion = Deno.env.get('AZURE_SPEECH_REGION')
    if (!azureKey || !azureRegion) {
      return new Response(JSON.stringify({ error: 'tts_not_configured' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const voiceKey = VOICE_MAP[body.voice] ? body.voice : 'female'
    const audio = await synthesize(text, VOICE_MAP[voiceKey], azureKey, azureRegion)

    // Best effort — a failed cache upload never blocks playback.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceKey && audio.length > 100) {
      try {
        const path = `${voiceKey}/${await sha256Hex(voiceKey + '|' + text)}.mp3`
        await fetch(`${supabaseUrl}/storage/v1/object/tts-cache/${path}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey,
            'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'cache-control': 'max-age=31536000',
          },
          body: audio,
        })
      } catch (e) { console.warn('[tts-proxy] cache upload failed', e) }
    }

    return new Response(audio, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (e) {
    console.error('[tts-proxy]', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
