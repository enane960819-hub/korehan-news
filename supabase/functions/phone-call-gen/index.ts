// phone-call-gen — admin-only generator for Phone Call listening lessons.
//
// POST { scenario, level, category?, speakerA?, speakerB? }
//   1. Claude writes a realistic Korean phone call for the level (JSON).
//   2. ElevenLabs reads every line (two voices, eleven_multilingual_v2).
//   3. The MP3 clips are concatenated, uploaded to the public 'phone-calls'
//      bucket, and a phone_calls row is inserted as a draft (is_active=false)
//      with per-line start/end times measured from the clips — no manual
//      timestamping. The admin previews it in the CMS, then activates it.
//
// Keys: app_settings 'anthropic_key' and 'elevenlabs_key' (admin CMS →
// Settings). Optional voice overrides: 'elevenlabs_voice_female',
// 'elevenlabs_voice_male' (voice IDs).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractJsonObject } from '../_shared/article-analysis.ts'

const ADMIN_EMAIL = 'enane960819@gmail.com'
const MODEL_SCRIPT = 'claude-sonnet-4-6'
const TTS_MODEL = 'eleven_multilingual_v2'
const BITRATE = 128_000 // mp3_44100_128 → CBR, so duration = bytes*8/bitrate
const GAP_BREAK = '<break time="0.6s" />'
// Premade multilingual voices used when the account has no Korean voice.
const FALLBACK_VOICES = { female: 'EXAVITQu4vr4xnSDxMaL', male: 'pNInz6obpgDQGcFmaJgB' }
const LEVEL_GUIDE: Record<string, string> = {
  Starter: 'Seed (absolute beginner): 6–8 very short turns, 해요체, high-frequency words only.',
  Beginner: 'Sprout (TOPIK 1–2): 8–10 turns, 해요체/합쇼체 as the situation needs, simple connectives.',
  Intermediate: 'Tree (TOPIK 3–4): 10–14 turns, natural service-call or friend-call register, some fillers and repairs.',
  Advanced: 'Forest (TOPIK 5–6): 12–16 turns, fast natural speech, idioms and indirect expressions.',
}

let corsHeaders: Record<string, string> = {}
function setCors(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ['https://korehani.com', 'https://www.korehani.com', 'https://korehannews.com', 'https://www.korehannews.com', 'http://localhost:3000', 'http://localhost:8888']
  corsHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
}

function scriptPrompt(scenario: string, level: string, category: string): string {
  return 'Write a realistic Korean PHONE CALL for a Korean-learning listening lesson.\n'
    + 'Scenario: ' + scenario + '\nCategory: ' + category + '\nLevel: ' + (LEVEL_GUIDE[level] || LEVEL_GUIDE.Beginner) + '\n\n'
    + 'Rules:\n'
    + '- Sound like a real call, not a textbook: 여보세요, 네네, 잠시만요, 아 네, 어… where natural; short turns; people confirm details (names, times, numbers) the way Koreans do on the phone.\n'
    + '- Every Korean line must be something a native speaker would actually say. Correct speech levels for the relationship (staff ↔ customer: 합쇼체/해요체; friends: 반말).\n'
    + '- Speaker A opens the call (or answers it). Two speakers only, A and B.\n'
    + '- No narration, no stage directions inside lines, no emojis.\n'
    + '- bold_words: 1–3 key words/expressions from that line worth learning (must appear in the line).\n\n'
    + 'Return ONLY JSON:\n'
    + '{"title":"<short Korean title>","title_en":"<English title>","description":"<one English sentence: who calls whom and why>",'
    + '"speakers":{"A":{"name":"<Korean role/name, e.g. 손님>","gender":"female|male"},"B":{"name":"<e.g. 식당 직원>","gender":"female|male"}},'
    + '"lines":[{"speaker":"A","ko":"...","en":"...","bold_words":["..."]}]}'
}

async function callClaude(sb: any, apiKey: string, prompt: string): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL_SCRIPT, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200))
  const d = await r.json()
  // Cost telemetry → claude_api_usage (same table the cost dashboard reads).
  try {
    const u = d.usage || {}
    sb.from('claude_api_usage').insert({
      user_id: null, feature: 'cron:phone-call-gen', model: MODEL_SCRIPT,
      input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      output_tokens: u.output_tokens || 0,
    }).then(() => {}, () => {})
  } catch (_) { /* swallow */ }
  return (d.content || []).map((c: { text?: string }) => c.text || '').join('')
}

async function pickVoices(xiKey: string, conf: Record<string, string>) {
  const out = { female: conf.elevenlabs_voice_female || '', male: conf.elevenlabs_voice_male || '' }
  if (out.female && out.male) return out
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': xiKey } })
    if (r.ok) {
      const voices: any[] = (await r.json()).voices || []
      const korean = voices.filter((v) => /korean|ko\b|한국/i.test(JSON.stringify(v.labels || {}) + ' ' + (v.name || '') + ' ' + (v.description || '')))
      for (const g of ['female', 'male'] as const) {
        if (out[g]) continue
        const v = korean.find((x) => String(x.labels?.gender || '').toLowerCase() === g)
        if (v) out[g] = v.voice_id
      }
    }
  } catch (_) { /* fall back below */ }
  return { female: out.female || FALLBACK_VOICES.female, male: out.male || FALLBACK_VOICES.male }
}

async function tts(xiKey: string, voiceId: string, text: string, prev: string, next: string): Promise<Uint8Array> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': xiKey, 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text, model_id: TTS_MODEL, previous_text: prev || undefined, next_text: next || undefined,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  })
  if (!r.ok) throw new Error('ElevenLabs ' + r.status + ': ' + (await r.text()).slice(0, 200))
  return stripId3(new Uint8Array(await r.arrayBuffer()))
}

// Drop a leading ID3v2 tag so concatenated clips stay one clean MP3 stream.
function stripId3(b: Uint8Array): Uint8Array {
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f)
    return b.subarray(10 + size)
  }
  return b
}

Deno.serve(async (req) => {
  setCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
  const sb = createClient(supabaseUrl, serviceKey)
  try {
    const check = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: req.headers.get('Authorization') || '', apikey: anonKey } })
    const user = check.ok ? await check.json().catch(() => null) : null
    if (!user?.email || user.email !== ADMIN_EMAIL) return json({ ok: false, error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const scenario = String(body?.scenario || '').trim().slice(0, 300)
    const level = ['Starter', 'Beginner', 'Intermediate', 'Advanced'].includes(body?.level) ? body.level : 'Beginner'
    const category = String(body?.category || 'Daily').slice(0, 40)
    if (!scenario) return json({ ok: false, error: 'scenario_required' }, 400)

    const { data: settings } = await sb.from('app_settings').select('key,value')
      .in('key', ['anthropic_key', 'elevenlabs_key', 'elevenlabs_voice_female', 'elevenlabs_voice_male'])
    const conf: Record<string, string> = {}
    for (const r of settings || []) conf[r.key] = String(r.value || '')
    if (!conf.anthropic_key) return json({ ok: false, error: 'no_anthropic_key' }, 503)
    if (!conf.elevenlabs_key) return json({ ok: false, error: 'no_elevenlabs_key' }, 503)

    // 1) Script
    const script = extractJsonObject(await callClaude(sb, conf.anthropic_key, scriptPrompt(scenario, level, category)))
    const lines: any[] = (Array.isArray(script?.lines) ? script.lines : [])
      .filter((l: any) => l && (l.speaker === 'A' || l.speaker === 'B') && String(l.ko || '').trim())
      .slice(0, 20)
    if (lines.length < 4) throw new Error('script too short')
    const speakers = script.speakers || {}

    // 2) Voices + TTS (sequential keeps previous/next context and stays
    //    well inside ElevenLabs concurrency limits).
    const voices = await pickVoices(conf.elevenlabs_key, conf)
    const voiceFor = (sp: 'A' | 'B') => {
      const g = String(speakers?.[sp]?.gender || (sp === 'A' ? 'female' : 'male')).toLowerCase() === 'male' ? 'male' : 'female'
      const other = sp === 'A' ? 'B' : 'A'
      const og = String(speakers?.[other]?.gender || '').toLowerCase()
      // Same gender on both sides → still use two different voices.
      if (og === g && sp === 'B') return g === 'male' ? (conf.elevenlabs_voice_male2 || FALLBACK_VOICES.female) : (conf.elevenlabs_voice_female2 || FALLBACK_VOICES.male)
      return voices[g]
    }
    const clips: Uint8Array[] = []
    const timed: any[] = []
    let t = 0
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const text = (i > 0 ? GAP_BREAK + ' ' : '') + String(l.ko).trim()
      const clip = await tts(conf.elevenlabs_key, voiceFor(l.speaker), text, i > 0 ? String(lines[i - 1].ko) : '', i + 1 < lines.length ? String(lines[i + 1].ko) : '')
      const dur = (clip.length * 8) / BITRATE
      const gap = i > 0 ? 0.6 : 0
      timed.push({
        speaker: l.speaker,
        start: Math.round((t + gap) * 100) / 100,
        end: Math.round((t + dur) * 100) / 100,
        ko: String(l.ko).trim(),
        en: String(l.en || '').trim(),
        bold_words: (Array.isArray(l.bold_words) ? l.bold_words : []).filter((w: unknown) => typeof w === 'string' && String(l.ko).includes(w as string)).slice(0, 3),
      })
      clips.push(clip)
      t += dur
    }
    const total = clips.reduce((n, c) => n + c.length, 0)
    const audio = new Uint8Array(total)
    let off = 0
    for (const c of clips) { audio.set(c, off); off += c.length }

    // 3) Upload + draft row
    const path = `generated/${Date.now()}_${level}.mp3`
    const up = await sb.storage.from('phone-calls').upload(path, audio, { contentType: 'audio/mpeg', upsert: false })
    if (up.error) throw new Error('upload: ' + up.error.message)
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/phone-calls/${path}`
    const { data: maxRow } = await sb.from('phone_calls').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const row = {
      title: String(script.title || scenario).slice(0, 120),
      title_en: String(script.title_en || '').slice(0, 160),
      description: String(script.description || '').slice(0, 300),
      category, difficulty: level,
      audio_url: audioUrl,
      duration_seconds: Math.round(t),
      script: timed,
      speakers: {
        A: { name: String(speakers?.A?.name || '화자 A'), color: '#34d399' },
        B: { name: String(speakers?.B?.name || '화자 B'), color: '#60a5fa' },
      },
      is_active: false,
      sort_order: ((maxRow?.sort_order as number) || 0) + 1,
    }
    const ins = await sb.from('phone_calls').insert(row).select('id').single()
    if (ins.error) throw new Error('insert: ' + ins.error.message)
    return json({ ok: true, id: ins.data.id, title: row.title, duration: row.duration_seconds, lines: timed.length, audio_url: audioUrl })
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300)
    console.error('[phone-call-gen]', msg)
    await sb.from('client_errors').insert({ message: 'phone-call-gen: ' + msg, severity: 'error', context: { source: 'phone-call-gen' }, user_agent: 'edge-function' }).then(() => {}, () => {})
    return json({ ok: false, error: 'generation_failed', detail: msg }, 500)
  }
})
