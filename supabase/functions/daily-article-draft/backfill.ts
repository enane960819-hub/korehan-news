// Overnight sentence-analysis backfill (F3). Published articles without the
// per-sentence analysis make their first reader wait for a live bake (or see
// "analysis unavailable" when signed out). A cron job calls
// daily-article-draft with {"backfill": true} every 20 min, 00:00–05:40 KST;
// each call bakes up to PER_RUN articles with the same prompt the reader's
// bake uses (Haiku, ~1¢ each), capped at DAILY_CAP per KST day.
// State lives in app_settings 'analysis_backfill_state'.

import { analysisPrompt, deriveTabs, extractJsonObject, SENT_CACHE_VERSION, stitchSentences } from '../_shared/article-analysis.ts'

const STATE_KEY = 'analysis_backfill_state'
const PER_RUN = 3
const DAILY_CAP = 60
const LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced']

function parseMaybe(v: unknown): any {
  if (!v) return null
  if (typeof v === 'object') return v
  try { return JSON.parse(String(v)) } catch (_) { return null }
}
function hasSentences(t: any): boolean {
  return !!(t && Array.isArray(t.sentences) && t.sentences.length)
}

export async function backfillAnalysis(
  sb: any,
  callHaiku: (prompt: string) => Promise<string>,
  kstToday: string,
): Promise<Record<string, unknown>> {
  const { data: st } = await sb.from('app_settings').select('value').eq('key', STATE_KEY).maybeSingle()
  let state: { date: string; done: number; failed: Record<string, number> } = parseMaybe(st?.value) || { date: '', done: 0, failed: {} }
  if (state.date !== kstToday) state = { date: kstToday, done: 0, failed: {} }
  if (state.done >= DAILY_CAP) return { skipped: 'daily_cap', done: state.done }

  const { data: arts } = await sb.from('articles').select('id, title, body, level')
    .eq('status', 'published').order('created_at', { ascending: false }).limit(500)
  const list = (arts || []).filter((a: any) => a?.body && String(a.body).trim())
  if (!list.length) return { skipped: 'no_articles' }

  const baked = new Set<string>()
  const ids = list.map((a: any) => String(a.id))
  for (let i = 0; i < ids.length; i += 100) {
    const { data: rows } = await sb.from('article_cache').select('article_id, translation').in('article_id', ids.slice(i, i + 100))
    for (const r of rows || []) if (hasSentences(parseMaybe(r.translation))) baked.add(String(r.article_id))
  }
  const todo = list.filter((a: any) => !baked.has(String(a.id)) && (state.failed[String(a.id)] || 0) < 2)
  const results: Array<Record<string, unknown>> = []

  for (const art of todo.slice(0, Math.min(PER_RUN, DAILY_CAP - state.done))) {
    const id = String(art.id)
    try {
      const level = LEVELS.includes(art.level) ? art.level : 'Beginner'
      const parsed = extractJsonObject(await callHaiku(analysisPrompt(art.title || '', art.body, level)))
      const sentences = stitchSentences(art.body, Array.isArray(parsed?.sentences) ? parsed.sentences : [])
      const filled = sentences.filter((s) => s.translation || s.vocab.length || s.analysis.length).length
      if (!sentences.length || filled < Math.floor(sentences.length * 0.8)) throw new Error(`incomplete ${filled}/${sentences.length}`)

      const { data: cur } = await sb.from('article_cache').select('translation, vocab, grammar').eq('article_id', id).maybeSingle()
      const existing = parseMaybe(cur?.translation)
      const translation = { ...(existing && typeof existing === 'object' ? existing : {}), sentences, version: SENT_CACHE_VERSION }
      const row: Record<string, string> = { translation: JSON.stringify(translation) }
      const tabs = deriveTabs(sentences, level)
      if (!parseMaybe(cur?.vocab)?.length && tabs.vocab.length) row.vocab = JSON.stringify(tabs.vocab)
      if (!parseMaybe(cur?.grammar)?.patterns?.length && tabs.grammar.patterns.length) row.grammar = JSON.stringify(tabs.grammar)
      const { error } = await sb.from('article_cache').upsert({ article_id: id, ...row }, { onConflict: 'article_id' })
      if (error) throw new Error('cache write: ' + error.message)
      state.done++
      results.push({ id, ok: true })
    } catch (e) {
      state.failed[id] = (state.failed[id] || 0) + 1
      results.push({ id, ok: false, error: String((e as Error)?.message || e).slice(0, 120) })
    }
  }
  await sb.from('app_settings').upsert({ key: STATE_KEY, value: JSON.stringify(state) }, { onConflict: 'key' })
  return { remaining: Math.max(0, todo.length - results.filter((r) => r.ok).length), done_today: state.done, results }
}
