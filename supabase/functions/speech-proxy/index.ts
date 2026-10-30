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
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : null
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
  if (matched) h['Access-Control-Allow-Origin'] = matched
  return h
}

function json(body: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Pronunciation scoring backs the free Speaking Practice step as well as
// Premium speaking feedback, so Free accounts keep it with a smaller daily
// cap; past the cap the Study Room falls back to the browser's own speech
// recognition (_speakAnalyzeAzure returns null on any non-200).
// Per-user daily caps (2026-10-30), KST day: Free 15 (one Speaking Practice
// set plus retries), Premium 60 (a long session is ~10–20 recordings). The
// caps stop a script from draining the Azure Speech budget. Counted in
// edge_usage_daily via kh_edge_usage_take() (20261030_ai_quota_reserve.sql).
// Admin is uncapped.
const SPEECH_DAILY_LIMIT_FREE = 15
const SPEECH_DAILY_LIMIT = 60
const ADMIN_EMAILS = ['enane960819@gmail.com']
// Azure locale allow-list (the app only sends ko-KR); anything else → ko-KR.
const LANGUAGES = new Set(['ko-KR'])
// Azure's short-audio REST endpoint takes ≤60 s; 60 s of webm/m4a is well
// under 2 MB, so 8 MB leaves room for other codecs without allowing huge uploads.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_REFERENCE_CHARS = 1000
const AUDIO_TYPE_RE = /^audio\/[a-z0-9.+-]+(;\s*codecs=[a-z0-9.,=" -]+)?$/i

// Warm-instance cache for Azure Speech credentials so we don't hit
// app_settings on every pronunciation request. The Azure key + region
// only change when an admin rotates them via the admin CMS; a 5-minute
// TTL is short enough to pick up rotations without per-request load.
type AzureCreds = { key: string; region: string };
let _azureCredsCache: { value: AzureCreds; expiresAt: number } | null = null;
const AZURE_CREDS_TTL_MS = 5 * 60 * 1000;

async function getAzureCreds(
  sbUrl: string,
  serviceKey: string,
): Promise<AzureCreds | null> {
  const now = Date.now();
  if (_azureCredsCache && _azureCredsCache.expiresAt > now) {
    return _azureCredsCache.value;
  }
  const sb = createClient(sbUrl, serviceKey);
  const { data: settings, error } = await sb
    .from('app_settings')
    .select('key, value')
    .in('key', ['azure_speech_key', 'azure_speech_region']);
  if (error) {
    console.error('[speech-proxy] app_settings error:', error.message);
    return null;
  }
  const key = settings?.find((s: { key: string; value: string }) => s.key === 'azure_speech_key')?.value;
  const region = settings?.find((s: { key: string; value: string }) => s.key === 'azure_speech_region')?.value;
  if (!key || !region) return null;
  const creds = { key, region };
  _azureCredsCache = { value: creds, expiresAt: now + AZURE_CREDS_TTL_MS };
  return creds;
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
    const isAdmin = !!(user.email && ADMIN_EMAILS.includes(user.email))
    if (!isAdmin && !user.email_confirmed_at) {
      return json({ error: 'Please verify your email first.', code: 'email_unverified' }, 403, cors)
    }
    const sbAdmin = createClient(supabaseUrl, supabaseServiceKey)
    let dailyLimit = SPEECH_DAILY_LIMIT_FREE
    if (!isAdmin) {
      const { data: prem, error: premErr } = await sbAdmin.rpc('kh_is_premium', { p_user: user.id })
      if (premErr) console.error('[speech-proxy] kh_is_premium failed:', premErr.message)
      if (prem === true) dailyLimit = SPEECH_DAILY_LIMIT
    }

    // ── 2. Parse multipart form ──────────────────────────────────
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return json({ error: 'Expected multipart/form-data' }, 400, cors)
    }

    const audioEntry = formData.get('audio')
    const audioFile = (audioEntry && typeof audioEntry !== 'string') ? audioEntry as File : null
    const refEntry = formData.get('referenceText')
    const referenceText = typeof refEntry === 'string' ? refEntry.trim() : ''
    const langEntry = formData.get('language')
    const language = (typeof langEntry === 'string' && LANGUAGES.has(langEntry)) ? langEntry : 'ko-KR'
    const ctEntry = formData.get('contentType')
    const audioContentType = (typeof ctEntry === 'string' && AUDIO_TYPE_RE.test(ctEntry)) ? ctEntry : 'audio/webm'

    if (!audioFile || !referenceText) {
      return json({ error: 'Missing audio or referenceText' }, 400, cors)
    }
    if (referenceText.length > MAX_REFERENCE_CHARS) {
      return json({ error: 'referenceText too long' }, 413, cors)
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return json({ error: 'Audio too large' }, 413, cors)
    }

    // Daily cap — reserve one assessment before calling Azure. Fails open
    // only while the counter function isn't deployed (migration pending).
    if (!isAdmin) {
      const { data: take, error: takeErr } = await sbAdmin.rpc('kh_edge_usage_take', {
        p_user: user.id, p_service: 'speech', p_limit: dailyLimit,
      })
      const missingFn = !!takeErr && (takeErr.code === 'PGRST202' || takeErr.code === '42883')
      if (takeErr && !missingFn) {
        console.error('[speech-proxy] usage counter failed:', takeErr.message)
        return json({ error: 'Usage check failed' }, 503, cors)
      }
      if (!takeErr && (!take || take.ok !== true)) {
        return json({ error: 'Daily speaking limit reached', code: 'speech_daily_limit' }, 429, cors)
      }
    }

    // ── 3. Azure credentials from app_settings (cached 5 min) ────
    const creds = await getAzureCreds(supabaseUrl, supabaseServiceKey)
    if (!creds) {
      return json({ error: 'Azure Speech not configured' }, 503, cors)
    }
    const azureKey = creds.key
    const azureRegion = creds.region
    if (!/^[a-z0-9-]+$/i.test(azureRegion)) {
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
      `?language=${encodeURIComponent(language)}&format=detailed`

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
