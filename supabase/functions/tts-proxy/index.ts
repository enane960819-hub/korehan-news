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
  'https://korehannews.com',
  'https://www.korehannews.com',
  'http://localhost:3000',
  'http://localhost:8888',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function getAuthToken(): Promise<string> {
  // Get a fresh auth token for Microsoft's speech service
  const res = await fetch('https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken', {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': 'dummy',
    },
  })
  // Fallback: use the edge token endpoint
  const tokenRes = await fetch(
    'https://eastus.tts.speech.microsoft.com/cognitiveservices/voices/list',
    { headers: { 'Accept': 'application/json' } }
  )
  return ''
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
