// Pure helpers for reviewing a week's generated study content
// (study_daily_content row) and the pre-baked Key Expressions list.
// Flagged items are dropped (or, for a vocab gloss, corrected) — a
// learner never sees something the reviewer marked as unnatural.

import type { Line } from './pack.ts'

type Ex = { ko?: string; en?: string }
type Grammar = { pattern?: string; explanation?: string; example_ko?: string; example_en?: string; examples?: Ex[]; parts?: unknown }
export type ContentRow = {
  vocab?: Array<{ ko?: string; en?: string; rom?: string }>
  grammar?: Grammar[]
  helpers?: Ex[]
  dictation_sentences?: Ex[]
  dictation_questions?: Array<{ question_ko?: string; answer_ko?: string; hint_en?: string }>
  confusing_grammar?: Array<{ pair?: string[]; explanation?: string; wrong?: string; correct?: string }>
}
export type Flag = { id: string; reason?: string; fix_en?: string }

const arr = <T>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : [])

export function contentLines(row: ContentRow): Line[] {
  const out: Line[] = []
  arr(row.vocab).forEach((v, i) => out.push({ id: `V${i + 1}`, text: `MEANING CHECK — ${v.ko} = "${v.en}"  (flag if the English is not this word's real dictionary meaning; give fix_en)` }))
  arr(row.grammar).forEach((g, i) => {
    out.push({ id: `G${i + 1}.0`, text: `[${g.pattern}] ${g.example_ko}  —  "${g.example_en}"` })
    arr(g.examples).forEach((e, k) => out.push({ id: `G${i + 1}.${k + 1}`, text: `[${g.pattern}] ${e.ko}  —  "${e.en}"` }))
  })
  arr(row.helpers).forEach((h, i) => out.push({ id: `H${i + 1}`, text: `${h.ko}  —  "${h.en}"` }))
  arr(row.dictation_sentences).forEach((d, i) => out.push({ id: `D${i + 1}`, text: `${d.ko}  —  "${d.en}"` }))
  arr(row.dictation_questions).forEach((q, i) => out.push({ id: `Q${i + 1}`, text: `Q: ${q.question_ko}  A: ${q.answer_ko}` }))
  arr(row.confusing_grammar).forEach((c, i) => out.push({ id: `C${i + 1}`, text: `(this is the CORRECT example) ${c.correct}` }))
  return out
}

// Returns the patched fields + a short report.
export function applyContentFlags(row: ContentRow, flags: Flag[]): { patch: ContentRow; dropped: string[] } {
  const byId: Record<string, Flag> = {}
  flags.forEach((f) => { if (f && f.id) byId[f.id] = f })
  const dropped: string[] = []
  const bad = (id: string) => !!byId[id]

  const vocab = arr(row.vocab).flatMap((v, i) => {
    const f = byId[`V${i + 1}`]
    if (!f) return [v]
    if (f.fix_en && f.fix_en.trim()) { dropped.push(`V${i + 1} gloss→${f.fix_en}`); return [{ ...v, en: f.fix_en.trim() }] }
    dropped.push(`V${i + 1}`); return []
  })

  const grammar = arr(row.grammar).flatMap((g, i) => {
    const pool: Ex[] = []
    if (!bad(`G${i + 1}.0`) && g.example_ko) pool.push({ ko: g.example_ko, en: g.example_en })
    arr(g.examples).forEach((e, k) => { if (!bad(`G${i + 1}.${k + 1}`)) pool.push(e) })
    if (!pool.length) { dropped.push(`G${i + 1}`); return [] }
    const out: Grammar = { ...g }
    if (bad(`G${i + 1}.0`)) {
      // Main example replaced — its colour-coded parts no longer match.
      dropped.push(`G${i + 1}.0`)
      out.example_ko = pool[0].ko; out.example_en = pool[0].en
      delete out.parts
      out.examples = pool.slice(1)
    } else {
      out.examples = pool.slice(1)
    }
    return [out]
  })

  const keep = <T>(list: T[] | undefined, p: string) => arr(list).filter((_, i) => {
    if (bad(`${p}${i + 1}`)) { dropped.push(`${p}${i + 1}`); return false }
    return true
  })

  const patch: ContentRow = {
    vocab,
    grammar,
    helpers: keep(row.helpers, 'H'),
    dictation_sentences: keep(row.dictation_sentences, 'D'),
    dictation_questions: keep(row.dictation_questions, 'Q'),
  }
  if (Array.isArray(row.confusing_grammar)) patch.confusing_grammar = keep(row.confusing_grammar, 'C')
  return { patch, dropped }
}

type Expression = { ko?: string; en?: string; examples?: Ex[] }

export function keLines(list: Expression[]): Line[] {
  const out: Line[] = []
  list.forEach((x, i) => {
    out.push({ id: `K${i + 1}`, text: `PATTERN CHECK — ${x.ko} = "${x.en}"  (a reusable pattern; ~ marks a slot)` })
    arr(x.examples).forEach((e, k) => out.push({ id: `K${i + 1}.${k + 1}`, text: `${e.ko}  —  "${e.en}"` }))
  })
  return out
}

export function applyKeFlags(list: Expression[], flags: Flag[]): { list: Expression[]; dropped: string[] } {
  const bad = new Set(flags.map((f) => f.id))
  const dropped: string[] = []
  const out = list.flatMap((x, i) => {
    if (bad.has(`K${i + 1}`)) { dropped.push(`K${i + 1}`); return [] }
    const ex = arr(x.examples).filter((_, k) => {
      if (bad.has(`K${i + 1}.${k + 1}`)) { dropped.push(`K${i + 1}.${k + 1}`); return false }
      return true
    })
    if (!ex.length) { dropped.push(`K${i + 1}`); return [] }
    return [{ ...x, examples: ex }]
  })
  return { list: out, dropped }
}
