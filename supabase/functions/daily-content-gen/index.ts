// Daily Content Generator — runs on cron schedule
// Generates study_daily_content for all 4 levels × today + tomorrow
// Triggered by: pg_cron → pg_net HTTP call, or manual invoke
//
// Deploy: supabase functions deploy daily-content-gen
// Cron setup (run in Supabase SQL Editor):
//   select cron.schedule('daily-content-gen', '0 0,15 * * *',
//     $$select net.http_post(
//       url := 'https://samghztrdvtxmrmawneu.supabase.co/functions/v1/daily-content-gen',
//       headers := jsonb_build_object(
//         'Content-Type','application/json',
//         'Authorization','Bearer ' || current_setting('app.settings.service_role_key')
//       ),
//       body := '{}'::jsonb
//     )$$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALL_LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced'] as const
type Level = typeof ALL_LEVELS[number]

// KST date helpers
function kstToday(): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number): string {
  const ms = new Date(dateStr + 'T00:00:00+09:00').getTime() + n * 86400_000
  return new Date(ms).toISOString().slice(0, 10)
}

function buildPrompt(level: Level, topicHint: string): string {
  const levelGuide: Record<Level, string> = {
    Starter:      'STARTER (TOPIK 0): Ultra-basic. Daily life, family, food. Vocab: 1-2 syllable words. Grammar: ~이에요/예요, ~있어요/없어요. Sentences max 4 words.',
    Beginner:     'BEGINNER (TOPIK 1-2): Present tense (~아요/어요). Basic particles. Everyday vocab. Helper sentences 5-8 words.',
    Intermediate: 'INTERMEDIATE (TOPIK 3-4): Past tense, conjunctions, modals. Sentences 8-12 words. Topic-specific terms.',
    Advanced:     'ADVANCED (TOPIK 5-6): Complex structures, formal style, advanced connectors. Sentences 12+ words. Abstract vocab.',
  }

  let levelExtra = ''
  let levelExtraCounts = ''

  if (level === 'Beginner') {
    levelExtra = '\nFor each grammar item, also include a "parts" array that breaks example_ko into color-coded parts: [{"text":"word","role":"subject|object|verb|particle|other"}]. Every word in example_ko must appear.'
  }
  if (level === 'Intermediate' || level === 'Advanced') {
    levelExtra += ',"confusing_grammar":[{"pair":["~grammar1","~grammar2"],"explanation":"","wrong":"","correct":""}]'
    levelExtraCounts += ', confusing_grammar=2'
  }
  if (level === 'Advanced') {
    levelExtra += ',"formality_exercise":{"casual":"","formal":"","explanation":""},"culture_note":"1-2 sentence Korean cultural note"'
    levelExtraCounts += ', formality_exercise=1, culture_note=1'
  }

  return `Korean language teacher. Create daily study content for ${level} level.
Level: ${levelGuide[level]}
${topicHint}

Return ONLY valid JSON (strict RFC8259, no markdown, no comments, no trailing commas):
{"topic_ko":"...","topic_en":"...",
"vocab":[{"ko":"word","rom":"romanization","en":"meaning","level":"${level}"}],
"grammar":[{"level":"${level}","pattern":"~grammar pattern","explanation":"English explanation","example_ko":"Korean example","example_en":"English translation"}],
"helpers":[{"ko":"Full Korean example sentence about the topic","en":"English translation"}],
"dictation_sentences":[{"ko":"","en":""}],
"dictation_questions":[{"question_ko":"","answer_ko":"","hint_en":""}]${levelExtra}}
Exact counts: vocab=5, grammar=3, helpers=4, dictation_sentences=3, dictation_questions=3${levelExtraCounts}.
IMPORTANT: "helpers" are full example SENTENCES (not single words) that a student can reference before writing.`
}

async function callAnthropic(apiKey: string, prompt: string): Promise<Record<string, unknown>> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`)
  const data = await resp.json()
  const raw = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  const clean = raw.replace(/```json|```/g, '').trim()
  const s = clean.indexOf('{')
  const e = clean.lastIndexOf('}')
  if (s < 0 || e <= s) throw new Error('No JSON in response')
  return JSON.parse(clean.slice(s, e + 1))
}

Deno.serve(async (req) => {
  try {
    // Auth: only allow service_role key (cron) or admin
    const authHeader = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify: must be service_role bearer token
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceKey) {
      // Check if it's an admin user
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
      const check = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: anonKey },
      })
      if (!check.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
      const user = await check.json()
      if (!user?.email || user.email !== 'enane960819@gmail.com') {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 })
      }
    }

    const sb = createClient(supabaseUrl, serviceKey)

    // Get Anthropic API key
    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No Anthropic API key' }), { status: 500 })
    }

    // Determine dates: today + tomorrow (KST)
    const today = kstToday()
    const tomorrow = addDays(today, 1)
    const dates = [today, tomorrow]

    // Check existing content
    const { data: existing } = await sb
      .from('study_daily_content')
      .select('scheduled_date,level,vocab')
      .in('scheduled_date', dates)

    const hasContent: Record<string, boolean> = {}
    for (const r of existing || []) {
      const hasVocab = r.vocab && (Array.isArray(r.vocab) ? r.vocab.length > 0 : typeof r.vocab === 'string' && r.vocab.length > 2)
      if (hasVocab) hasContent[`${r.scheduled_date}_${r.level}`] = true
    }

    // Build missing list
    const missing: Array<{ date: string; level: Level }> = []
    for (const date of dates) {
      for (const level of ALL_LEVELS) {
        if (!hasContent[`${date}_${level}`]) {
          missing.push({ date, level })
        }
      }
    }

    if (!missing.length) {
      return new Response(JSON.stringify({ ok: true, message: 'All content exists', dates }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{ date: string; level: string; status: string }> = []

    for (const item of missing) {
      try {
        // Pick topic from writing_topics
        let topicHint = ''
        let forceTopic: { ko: string; en: string } | null = null
        const { data: topics } = await sb
          .from('writing_topics')
          .select('topic_ko,topic_en,category')
          .eq('level', item.level)
          .eq('active', true)
          .order('sort_order')
          .order('created_at')

        const allTopics = topics || []
        if (allTopics.length) {
          const epoch = new Date('2026-04-14T00:00:00+09:00').getTime()
          const now = new Date(item.date + 'T00:00:00+09:00').getTime()
          const idx = Math.max(0, Math.floor((now - epoch) / 86400_000)) % allTopics.length
          const t = allTopics[idx]
          topicHint = `Use EXACTLY this topic: "${t.topic_ko}" (${t.topic_en}). Category: ${t.category || ''}.`
          forceTopic = { ko: t.topic_ko, en: t.topic_en }
        } else {
          const cats = ['daily life', 'food & cooking', 'K-pop & music', 'travel in Korea', 'Korean seasons', 'school & studying', 'hobbies', 'Korean culture']
          const h = item.date.split('-').reduce((a, b) => a + parseInt(b), 0)
          topicHint = `Pick a specific topic within: "${cats[h % cats.length]}"`
        }

        const prompt = buildPrompt(item.level, topicHint)
        const parsed = await callAnthropic(apiKey, prompt)

        const rec = {
          scheduled_date: item.date,
          level: item.level,
          topic_ko: forceTopic?.ko || (parsed.topic_ko as string) || '',
          topic_en: forceTopic?.en || (parsed.topic_en as string) || '',
          vocab: parsed.vocab || [],
          grammar: parsed.grammar || [],
          helpers: parsed.helpers || [],
          dictation_sentences: parsed.dictation_sentences || [],
          dictation_questions: parsed.dictation_questions || [],
          confusing_grammar: parsed.confusing_grammar || [],
          formality_exercise: parsed.formality_exercise || null,
          culture_note: (parsed.culture_note as string) || '',
          status: 'approved',
          admin_edited: false,
          updated_at: new Date().toISOString(),
        }

        const { error } = await sb.from('study_daily_content').upsert(rec, { onConflict: 'scheduled_date,level' })
        if (error) throw new Error(error.message)

        results.push({ date: item.date, level: item.level, status: 'ok' })

        // Rate limit: 2s between API calls
        if (missing.indexOf(item) < missing.length - 1) {
          await new Promise(r => setTimeout(r, 2000))
        }
      } catch (e) {
        results.push({ date: item.date, level: item.level, status: `error: ${(e as Error).message}` })
      }
    }

    return new Response(JSON.stringify({ ok: true, dates, generated: results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
