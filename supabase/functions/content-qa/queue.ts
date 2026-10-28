// Review queue for AI-made content that learners share but that no one
// reviewed: article analysis (article_cache), the shared AI caches
// (grammar_examples_cache) and the word bank (vocabulary_bank). Rows carry
// qa_at; a trigger clears it when the content changes, so anything new or
// regenerated — from the browser, the admin tools or a cron — comes back
// here. Pure helpers (no I/O).

import type { Line } from './pack.ts'
import type { Flag } from './content.ts'
import { romanize, romKey } from '../_shared/romanize.ts'

const HANGUL = /[가-힣]/
const KO_KEYS = ['ko', 'example_ko', 'ex_ko', 'korean', 'sentence_ko']
const EN_KEYS = ['en', 'example_en', 'ex_en', 'english', 'sentence_en', 'meaning', 'translation']

type Item = { id: string; kind: 'gloss' | 'sent' | 'quiz'; holder: any; parent: any[] | null; enKey: string | null }

function pick(o: any, keys: string[]): [string | null, string] {
  for (const k of keys) if (typeof o?.[k] === 'string' && o[k].trim()) return [k, o[k].trim()]
  return [null, '']
}

// Every reviewable thing inside a JSON value, with where it lives.
export function jsonItems(root: unknown, prefix: string): { items: Item[]; lines: Line[] } {
  const items: Item[] = [], lines: Line[] = []
  let n = 0
  const visit = (v: any, parent: any[] | null) => {
    if (Array.isArray(v)) { v.forEach((x) => visit(x, v)); return }
    if (!v || typeof v !== 'object') return
    // Fill-in-the-blank quiz question
    if (typeof v.sentence === 'string' && /_{2,}/.test(v.sentence) && v.blank && Array.isArray(v.choices)) {
      const id = `${prefix}${++n}`
      const others = v.choices.filter((c: string) => c !== v.blank)
      items.push({ id, kind: 'quiz', holder: v, parent, enKey: null })
      lines.push({ id, text: `QUIZ — "${v.sentence}" answer: ${v.blank}; other choices: ${others.join(', ')}  (flag if the sentence with the answer is unnatural, if the answer doesn't fit, or if ANY other choice would also be correct in the blank)` })
    } else {
      const [koKey, ko] = pick(v, KO_KEYS)
      if (koKey && HANGUL.test(ko)) {
        const [enKey, en] = pick(v, EN_KEYS)
        const id = `${prefix}${++n}`
        const isGloss = !/\s/.test(ko.replace(/^~/, '')) || ko.length <= 6
        if (isGloss && en) {
          items.push({ id, kind: 'gloss', holder: v, parent, enKey })
          lines.push({ id, text: `MEANING CHECK — ${ko} = "${en}"  (flag if this is not the word's real meaning, or lists rare/unrelated senses; fix_en = the 1-3 senses a learner needs)` })
        } else if (!isGloss) {
          items.push({ id, kind: 'sent', holder: v, parent, enKey })
          lines.push({ id, text: `${ko}${en ? `  —  "${en}"` : ''}` })
        }
      }
    }
    for (const k of Object.keys(v)) { const x = v[k]; if (x && typeof x === 'object') visit(x, Array.isArray(x) ? x : null) }
  }
  visit(root, null)
  return { items, lines }
}

// Applies flags in place: gloss fixes rewrite the English, other flagged
// items are removed from their list. Returns false when too much of the
// value was bad (or a flagged item isn't in a list) — the caller then drops
// the whole value so it is generated again.
export function applyJsonFlags(items: Item[], flags: Flag[]): { ok: boolean; dropped: string[] } {
  const byId: Record<string, Flag> = {}
  flags.forEach((f) => { if (f?.id) byId[f.id] = f })
  const dropped: string[] = []
  let removed = 0, fatal = false
  for (const it of items) {
    const f = byId[it.id]
    if (!f) continue
    if (it.kind === 'gloss' && f.fix_en && f.fix_en.trim() && it.enKey) {
      it.holder[it.enKey] = f.fix_en.trim(); dropped.push(`${it.id} gloss→${f.fix_en.trim()}`); continue
    }
    dropped.push(it.id)
    if (it.parent) { const i = it.parent.indexOf(it.holder); if (i >= 0) { it.parent.splice(i, 1); removed++ } }
    else fatal = true
  }
  const ok = !fatal && removed <= Math.max(1, Math.floor(items.length * 0.4))
  return { ok, dropped }
}

// Word bank lines: meaning for every word, romanization only where the
// stored value disagrees with the rule-based one.
export function vocabLines(rows: Array<{ word_key: string; word_ko: string; word_en: string; word_rom: string }>): Line[] {
  const out: Line[] = []
  rows.forEach((w, i) => {
    out.push({ id: `W${i + 1}`, text: `MEANING CHECK — ${w.word_ko} = "${w.word_en}"  (flag if wrong, or if it lists rare/unrelated senses; fix_en = the 1-3 senses a learner needs, short)` })
    const rule = romanize(w.word_ko)
    if (w.word_rom && romKey(w.word_rom) !== romKey(rule)) {
      out.push({ id: `R${i + 1}`, text: `ROM CHECK — ${w.word_ko}: stored "${w.word_rom}", rule-based "${rule}"  (flag only if the stored one is wrong; fix_rom = correct Revised Romanization)` })
    }
  })
  return out
}
