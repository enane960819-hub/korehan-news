/**
 * TTS Proxy — Free Microsoft Edge Neural TTS
 * Voices: ko-KR-SunHiNeural (여), ko-KR-InJoonNeural (남)
 * Uses Edge browser's speech synthesis REST endpoint
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

async function synthesize(text: string, voiceName: string): Promise<Uint8Array> {
  const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
  const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TOKEN}`

  const requestId = crypto.randomUUID().replace(/-/g, '')
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR"><voice name="${voiceName}"><prosody rate="+0%" pitch="+0Hz">${escapeXml(text)}</prosody></voice></speak>`

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 12000)
    const chunks: Uint8Array[] = []

    const ws = new WebSocket(WSS_URL)

    ws.addEventListener('open', () => {
      // Config message
      ws.send(
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        })
      )
      // SSML request
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`
      )
    })

    ws.addEventListener('message', (evt) => {
      if (typeof evt.data === 'string') {
        if (evt.data.includes('Path:turn.end')) {
          clearTimeout(timer)
          ws.close()
          // Merge chunks
          const total = chunks.reduce((a, c) => a + c.length, 0)
          const out = new Uint8Array(total)
          let off = 0
          for (const c of chunks) { out.set(c, off); off += c.length }
          resolve(out)
        }
      } else if (evt.data instanceof Blob) {
        // Deno WebSocket returns Blob for binary frames
        evt.data.arrayBuffer().then((ab: ArrayBuffer) => {
          const view = new Uint8Array(ab)
          // Find end of text header (after "Path:audio\r\n")
          let i = 0
          for (; i < Math.min(view.length, 300); i++) {
            // Look for \r\n after "Path:audio"
            if (view[i] === 0x0D && view[i + 1] === 0x0A && i > 10) {
              chunks.push(view.slice(i + 2))
              return
            }
          }
          chunks.push(view)
        })
      } else if (evt.data instanceof ArrayBuffer) {
        const view = new Uint8Array(evt.data)
        let i = 0
        for (; i < Math.min(view.length, 300); i++) {
          if (view[i] === 0x0D && view[i + 1] === 0x0A && i > 10) {
            chunks.push(view.slice(i + 2))
            return
          }
        }
        chunks.push(view)
      }
    })

    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('ws_error'))
    })

    ws.addEventListener('close', () => {
      clearTimeout(timer)
      if (chunks.length === 0) reject(new Error('no_audio'))
    })
  })
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Without JWT verification any caller could drive unlimited WSS
    // synthesis through this function — each call holds an outbound
    // socket for ~12s and burns the project's Edge Function CPU
    // budget. The 500-char cap below is only useful AFTER we've
    // already established that the caller is a logged-in user.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    const voice = VOICE_MAP[body.voice || 'female'] || VOICE_MAP.female
    const audio = await synthesize(text, voice)

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
