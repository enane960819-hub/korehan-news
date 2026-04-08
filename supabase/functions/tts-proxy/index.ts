/**
 * Edge TTS Proxy — Free Microsoft Neural TTS via Supabase Edge Function
 * Voices: ko-KR-SunHiNeural (여), ko-KR-InJoonNeural (남)
 * No API key required — uses Edge browser's speech synthesis endpoint
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
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

function makeRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function buildSSML(text: string, voice: string, rate = '+0%', pitch = '+0Hz'): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">` +
    `<voice name="${voice}">` +
    `<prosody rate="${rate}" pitch="${pitch}">${escaped}</prosody>` +
    `</voice></speak>`
}

async function synthesize(text: string, voice: string): Promise<Uint8Array> {
  const requestId = makeRequestId()
  const ssml = buildSSML(text, voice)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('TTS timeout'))
    }, 15000)

    const ws = new WebSocket(WSS_URL)
    const audioChunks: Uint8Array[] = []

    ws.onopen = () => {
      // Send config
      ws.send(
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
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

      // Send SSML
      ws.send(
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml
      )
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary message — audio data
        const view = new Uint8Array(event.data)
        // Skip the header (find the binary separator)
        const headerEnd = findHeaderEnd(view)
        if (headerEnd >= 0) {
          audioChunks.push(view.slice(headerEnd))
        }
      } else if (typeof event.data === 'string') {
        // Text message — check for turn.end
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timeout)
          ws.close()
          // Concatenate audio chunks
          const totalLen = audioChunks.reduce((a, c) => a + c.length, 0)
          const result = new Uint8Array(totalLen)
          let offset = 0
          for (const chunk of audioChunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          resolve(result)
        }
      }
    }

    ws.onerror = (err) => {
      clearTimeout(timeout)
      reject(new Error('WebSocket error'))
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      if (audioChunks.length === 0) {
        reject(new Error('No audio received'))
      }
    }
  })
}

function findHeaderEnd(data: Uint8Array): number {
  // Look for the double newline separator between header and audio data
  // The header ends with \r\n\r\n, and then a 2-byte length prefix
  const needle = [0x50, 0x61, 0x74, 0x68, 0x3A] // "Path:"
  for (let i = 0; i < Math.min(data.length, 500); i++) {
    if (data[i] === needle[0] && data[i + 1] === needle[1] && data[i + 2] === needle[2]) {
      // Find the \r\n\r\n after this
      for (let j = i; j < Math.min(data.length, i + 200); j++) {
        if (data[j] === 0x0D && data[j + 1] === 0x0A) {
          return j + 2
        }
      }
    }
  }
  // Fallback: just return 0 (include everything)
  return 0
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { text, voice: voiceKey } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Limit text length to prevent abuse
    const trimmed = text.slice(0, 500)
    const voice = VOICE_MAP[voiceKey || 'female'] || VOICE_MAP.female

    const audio = await synthesize(trimmed, voice)

    return new Response(audio, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
