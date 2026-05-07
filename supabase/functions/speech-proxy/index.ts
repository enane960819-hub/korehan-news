import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No authorization header' }, 401, cors)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401, cors)

    // ── 2. Parse multipart form ──────────────────────────────────
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return json({ error: 'Expected multipart/form-data' }, 400, cors)
    }

    const audioFile = formData.get('audio') as File | null
    const referenceText = (formData.get('referenceText') as string | null)?.trim()
    const language = (formData.get('language') as string | null) || 'ko-KR'
    const audioContentType = (formData.get('contentType') as string | null) || 'audio/webm'

    if (!audioFile || !referenceText) {
      return json({ error: 'Missing audio or referenceText' }, 400, cors)
    }

    // ── 3. Azure credentials from app_settings ───────────────────
    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const { data: settings, error: settErr } = await sb
      .from('app_settings')
      .select('key, value')
      .in('key', ['azure_speech_key', 'azure_speech_region'])

    if (settErr) {
      console.error('[speech-proxy] app_settings error:', settErr.message)
      return json({ error: 'Configuration unavailable' }, 503, cors)
    }

    const azureKey = settings?.find((s: { key: string; value: string }) => s.key === 'azure_speech_key')?.value
    const azureRegion = settings?.find((s: { key: string; value: string }) => s.key === 'azure_speech_region')?.value

    if (!azureKey || !azureRegion) {
      return json({ error: 'Azure Speech not configured' }, 503, cors)
    }

    // ── 4. Build Pronunciation Assessment header ─────────────────
    const pronConfig = btoa(JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Dimension: 'Comprehensive',
      EnableMiscue: true,
    }))

    // ── 5. Call Azure Speech REST API ────────────────────────────
    const azureUrl =
      `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=${language}&format=detailed`

    const audioBuffer = await audioFile.arrayBuffer()

    const azureRes = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': audioContentType,
        'Pronunciation-Assessment': pronConfig,
        'Accept': 'application/json',
      },
      body: audioBuffer,
    })

    if (!azureRes.ok) {
      const errText = await azureRes.text()
      console.error('[speech-proxy] Azure error:', azureRes.status, errText)
      return json({ error: 'Azure Speech API error', azureStatus: azureRes.status }, 502, cors)
    }

    // ── 6. Parse and return scores ───────────────────────────────
    const azureData = await azureRes.json()
    const best = azureData.NBest?.[0]
    const pa = best?.PronunciationAssessment

    const words = (best?.Words ?? []).map((w: {
      Word: string
      PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string }
    }) => ({
      word: w.Word,
      accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? null,
      errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
    }))

    return json({
      status: azureData.RecognitionStatus,
      transcript: azureData.DisplayText || best?.Display || '',
      pronunciationScore: pa?.PronScore ?? null,
      accuracyScore: pa?.AccuracyScore ?? null,
      fluencyScore: pa?.FluencyScore ?? null,
      completenessScore: pa?.CompletenessScore ?? null,
      words,
    }, 200, cors)

  } catch (err) {
    console.error('[speech-proxy] Unexpected error:', err)
    return json({ error: 'Internal server error' }, 500, cors)
  }
})
