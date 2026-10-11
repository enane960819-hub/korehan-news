// Nightly grammar harvest — runs once a day on an idle daily-article-draft
// tick. Article analysis labels grammar freely ("~(으)ㄹ 겸", "~는 바람에"),
// so new grammar keeps appearing in the news. Every label we haven't
// judged yet is sent (in one batch) to the model, which says whether it is
// an existing curriculum pattern, new grammar (→ added to
// grammar_curriculum as a Library shell; its lesson is generated on the
// first learner's click like every other pattern), or not grammar at all.
// Verdicts land in grammar_label_map, so each label costs one judgement
// ever. See supabase/migrations/20261011_grammar_label_map.sql.

const HARVEST_KEY = 'grammar_harvest_last'
const MAX_LABELS_PER_RUN = 80
const MAX_NEW_PER_RUN = 15
const MAX_RUNS_PER_DAY = 4
const LEVELS = ['Starter', 'Beginner', 'Intermediate', 'Advanced']

// Must stay identical to _gcNorm() in korehan/korehan-study-room.js.
export function gcNorm(s: string): string {
  return String(s || '').replace(/\([^)]*[A-Za-z][^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
    .replace(/\s+[—–]\s+.*$/, '').replace(/\s+→.*$/, '')
    .replace(/ㄹ\/을|을\/ㄹ/g, '(으)ㄹ').replace(/ㄴ\/은|은\/ㄴ/g, '(으)ㄴ').replace(/아\/어\/여/g, '아/어')
    .replace(/ㅂ\/습니다/g, '(스)ㅂ니다').replace(/verb/gi, 'v').replace(/\/a\b/gi, '')
    .replace(/^~/, '').replace(/[~\s]/g, '').toLowerCase()
}

const loose = (n: string) => n.replace(/\((으|스)\)/g, '')

function itemKeys(pattern: string): string[] {
  const head = pattern.replace(/\s+[—–]\s+.*$/, '')
  const keys = [gcNorm(pattern)]
  for (const seg of head.split(/\s+\/\s+/)) {
    const k = gcNorm(seg)
    if (k && !keys.includes(k)) keys.push(k)
  }
  return keys
}

async function readGrammarLabels(sb: any): Promise<Map<string, string>> {
  const labels = new Map<string, string>() // norm → first raw label
  const take = (raw: unknown) => {
    let v: any = raw
    if (typeof v === 'string') { try { v = JSON.parse(v) } catch (_) { return } }
    const list = Array.isArray(v?.patterns) ? v.patterns : Array.isArray(v) ? v : []
    for (const p of list) {
      const label = String(p?.name || p?.label || p?.pattern || '').trim()
      if (!label || label.length > 120) continue
      const n = gcNorm(label)
      if (n && n.length <= 200 && !labels.has(n)) labels.set(n, label)
    }
  }
  // kv schema first (prod), wide schema as fallback.
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb.from('article_cache').select('cache_value')
      .eq('content_type', 'article').eq('cache_key', 'grammar').range(from, from + 999)
    if (error) {
      if (from > 0) break
      for (let f2 = 0; f2 < 20000; f2 += 1000) {
        const w = await sb.from('article_cache').select('grammar').not('grammar', 'is', null).range(f2, f2 + 999)
        if (w.error || !w.data?.length) break
        w.data.forEach((r: any) => take(r.grammar))
        if (w.data.length < 1000) break
      }
      break
    }
    if (!data?.length) break
    data.forEach((r: any) => take(r.cache_value))
    if (data.length < 1000) break
  }
  return labels
}

export async function harvestGrammar(
  sb: any,
  ask: (prompt: string) => Promise<string>,
  parseJson: (raw: string) => any,
  today: string,
  force = false,
): Promise<Record<string, unknown> | null> {
  // State: {date, runs, remaining}. A backlog (first run) drains over up to
  // MAX_RUNS_PER_DAY idle ticks; otherwise one run a day.
  let state: any = null
  const { data: last } = await sb.from('app_settings').select('value').eq('key', HARVEST_KEY).maybeSingle()
  try { state = last?.value ? JSON.parse(String(last.value)) : null } catch (_) { state = null }
  const runs = state?.date === today ? Number(state.runs || 0) : 0
  if (!force && runs > 0 && (runs >= MAX_RUNS_PER_DAY || !state.remaining)) return null
  // Mark first: a failing run must not retry on every 5-minute tick.
  const mark = (remaining: number) => sb.from('app_settings').upsert(
    { key: HARVEST_KEY, value: JSON.stringify({ date: today, runs: runs + 1, remaining }) }, { onConflict: 'key' })
  await mark(0)

  const { data: cur, error: curErr } = await sb.from('grammar_curriculum').select('pattern, level, sort_order').eq('active', true)
  if (curErr) throw new Error('curriculum: ' + curErr.message)
  const byKey = new Map<string, string>()
  const byLoose = new Map<string, string>() // optional (으)/(스) dropped, like _gcLoose()
  for (const r of cur || []) for (const k of itemKeys(r.pattern)) {
    if (!byKey.has(k)) byKey.set(k, r.pattern)
    if (!byLoose.has(loose(k))) byLoose.set(loose(k), r.pattern)
  }

  const { data: seenRows, error: seenErr } = await sb.from('grammar_label_map').select('label_norm')
  if (seenErr) throw new Error('label map: ' + seenErr.message)
  const seen = new Set((seenRows || []).map((r: any) => r.label_norm))

  const labels = await readGrammarLabels(sb)
  const rows: any[] = []
  const pending: Array<{ norm: string; label: string }> = []
  for (const [norm, label] of labels) {
    if (seen.has(norm)) continue
    const hit = byKey.get(norm) || byLoose.get(loose(norm))
    if (hit) rows.push({ label_norm: norm, label, verdict: 'existing', pattern: hit })
    else pending.push({ norm, label })
  }
  const batch = pending.slice(0, MAX_LABELS_PER_RUN)
  let added = 0
  if (batch.length) {
    const curList = (cur || []).map((r: any) => '- ' + r.pattern + ' [' + r.level + ']').join('\n')
    const prompt =
      'You maintain the grammar curriculum of a Korean-learning site for foreign learners.\n'
      + 'CURRENT CURRICULUM (pattern [level]):\n' + curList + '\n\n'
      + 'NEW LABELS seen in news-article analysis:\n'
      + batch.map((b, i) => i + '. ' + b.label).join('\n') + '\n\n'
      + 'For EACH label decide:\n'
      + '- "existing": it is the same grammar point as a curriculum pattern (variants, contractions, particle allomorphs count as the same). Give that pattern string EXACTLY as listed.\n'
      + '- "new": a genuine, reusable grammar point (ending, connective, particle, auxiliary construction, fixed grammatical frame such as "-는 바람에", "-(으)ㄹ 겸") that the curriculum lacks. Give a canonical pattern in the curriculum\'s style: "<Korean form> — <short English meaning>", e.g. "(으)ㄴ/는 바람에 — Because (unexpected cause)". Also give level (Starter/Beginner/Intermediate/Advanced, by standard TOPIK ordering), unit (reuse a short unit name like "Reasons & causes", "Connecting actions", "Particles 2", "Formal & written", "Endings & attitude"), and a one-sentence English description.\n'
      + '- "skip": vocabulary, a verb collocation (e.g. "~을/를 추진하다", "관심을 끌다"), a noun, or anything that is not a grammar point.\n'
      + 'Be strict: when unsure between new and skip, choose skip. Several labels may map to the same new pattern — use the identical pattern string.\n'
      + 'Return ONLY JSON: {"items":[{"i":0,"verdict":"existing","pattern":"..."},{"i":1,"verdict":"new","pattern":"...","level":"Intermediate","unit":"...","description":"..."},{"i":2,"verdict":"skip"}]}'
    const out = parseJson(await ask(prompt))
    const items: any[] = Array.isArray(out?.items) ? out.items : []
    const curSet = new Set((cur || []).map((r: any) => r.pattern))
    const maxOrder: Record<string, number> = {}
    for (const r of cur || []) maxOrder[r.level] = Math.max(maxOrder[r.level] || 0, r.sort_order || 0)
    const created = new Map<string, string>() // norm → pattern created this run
    for (const it of items) {
      const b = batch[Number(it?.i)]
      if (!b) continue
      const verdict = String(it.verdict || '')
      let pattern = String(it.pattern || '').trim()
      if (verdict === 'existing' && curSet.has(pattern)) {
        rows.push({ label_norm: b.norm, label: b.label, verdict: 'existing', pattern })
      } else if (verdict === 'new' && pattern && pattern.length <= 160 && / — /.test(pattern)) {
        const pn = gcNorm(pattern)
        const dupe = byKey.get(pn) || byLoose.get(loose(pn)) || created.get(pn)
        if (dupe) { rows.push({ label_norm: b.norm, label: b.label, verdict: 'existing', pattern: dupe }); continue }
        if (added >= MAX_NEW_PER_RUN) continue // left unjudged → retried next night
        const level = LEVELS.includes(it.level) ? it.level : 'Intermediate'
        maxOrder[level] = (maxOrder[level] || 0) + 1
        const { error } = await sb.from('grammar_curriculum').insert({
          pattern, level, sort_order: Math.max(maxOrder[level], 900),
          description: String(it.description || '').slice(0, 300),
          unit: String(it.unit || 'From the news').slice(0, 60), tier: 'library', source: 'article', active: true,
        })
        if (error) { console.warn('[harvest] insert failed', pattern, error.message); continue }
        added++
        created.set(pn, pattern)
        rows.push({ label_norm: b.norm, label: b.label, verdict: 'new', pattern })
      } else if (verdict === 'skip') {
        rows.push({ label_norm: b.norm, label: b.label, verdict: 'skip', pattern: null })
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('grammar_label_map').upsert(rows.slice(i, i + 500), { onConflict: 'label_norm' })
    if (error) throw new Error('label map write: ' + error.message)
  }
  const remaining = Math.max(0, pending.length - batch.length)
  await mark(remaining)
  return { labels_total: labels.size, judged: rows.length, added_patterns: added, remaining }
}
