// Pure helpers for writing-flow topic packs (no I/O) — validated and
// combination-checked before a generated pack is ever shown to a learner.
// The Study Room reads the result from writing_topic_content exactly like
// the hand-written packs (js/features/writing-flow.js).

export type Slot = { slot: true; options: string[]; options_en: string[]; josa: string | null; ph?: string }
export type Frame = { parts: Array<string | Slot>; en: string }
export type Sentence = { ko: string; en: string; acceptable_orders: string[] }
export type Pack = {
  format: { label: string; hint: string }
  min_sentences: number
  models: Array<{ ko: string; en: string; hl: string[] }>
  patterns: Array<{ name: string; exp: string; ex_ko: string; ex_en: string; match: string[] }>
  frames: Frame[]
  words: string[]
  checklist: Array<{ label: string; any: string[]; optional?: boolean }>
  model_answer: string
  sentences: Sentence[]
  auto?: { generated_at: string; model: string }
}
export type Line = { id: string; text: string }

export const MIN_SENTENCES: Record<string, number> = { Starter: 2, Beginner: 3, Intermediate: 4, Advanced: 5 }
// Particles the client can attach (_wfJosa): consonant form first.
export const ALLOWED_JOSA = [null, '이/가', '을/를', '은/는', '이에요/예요', '에', '에서']

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u
const HANGUL = /[가-힣]/

export function batchim(word: string): boolean | null {
  const s = String(word || '').trim()
  if (!s) return null
  const code = s.charCodeAt(s.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return null
  return (code - 0xac00) % 28 !== 0
}
// Same as _wfJosa in writing-flow.js.
export function josa(word: string, j: string | null): string {
  if (!j) return word
  if (j.indexOf('/') < 0) return word + j
  const b = batchim(word)
  const pair = j.split('/')
  if (b === null) return word + '(' + j + ')'
  return word + (b ? pair[0] : pair[1])
}

const isSlot = (p: unknown): p is Slot => !!p && typeof p === 'object' && (p as Slot).slot === true

// Every sentence one frame can produce.
export function frameSentences(f: Frame): Array<{ text: string; picks: string[] }> {
  let acc: Array<{ text: string; picks: string[] }> = [{ text: '', picks: [] }]
  f.parts.forEach((p, pi) => {
    if (!isSlot(p)) { acc = acc.map((a) => ({ text: a.text + p, picks: a.picks })); return }
    const next: Array<{ text: string; picks: string[] }> = []
    acc.forEach((a) => p.options.forEach((o) => next.push({ text: a.text + josa(o, p.josa), picks: a.picks.concat(pi + ':' + o) })))
    acc = next
  })
  return acc.map((a) => ({ text: a.text.trim(), picks: a.picks }))
}

// Lines for the reviewer: each frame on its own, then every pair of frames
// side by side — that's where cross-frame clashes (아침 + 일이 끝나서) show.
export function comboLines(frames: Frame[]): { lines: Line[]; picksById: Record<string, string[]> } {
  const lines: Line[] = []
  const picksById: Record<string, string[]> = {}
  const per = frames.map(frameSentences)
  per.forEach((list, fi) => list.forEach((s, k) => {
    const id = `F${fi + 1}.${k + 1}`
    lines.push({ id, text: s.text })
    picksById[id] = s.picks.map((p) => fi + '|' + p)
  }))
  for (let i = 0; i < per.length; i++) {
    for (let j = i + 1; j < per.length; j++) {
      per[i].forEach((a, ai) => per[j].forEach((b, bi) => {
        const id = `P${i + 1}${j + 1}.${ai + 1}.${bi + 1}`
        lines.push({ id, text: a.text + ' ' + b.text })
        picksById[id] = a.picks.map((p) => i + '|' + p).concat(b.picks.map((p) => j + '|' + p))
      }))
    }
  }
  return { lines, picksById }
}

// Remove the options behind every flagged combination, worst offender first.
// Returns false if a slot would drop below 2 options (pack must be redone).
export function dropBadOptions(pack: Pack, badIds: string[], picksById: Record<string, string[]>): boolean {
  let open = badIds.filter((id) => picksById[id])
  while (open.length) {
    const count: Record<string, number> = {}
    open.forEach((id) => picksById[id].forEach((k) => { count[k] = (count[k] || 0) + 1 }))
    // Most-blamed option; ties go to the later frame (earlier frames set the scene).
    const worst = Object.keys(count).sort((a, b) => count[b] - count[a] || b.localeCompare(a))[0]
    const [fi, rest] = [Number(worst.split('|')[0]), worst.split('|')[1]]
    const pi = Number(rest.split(':')[0])
    const opt = rest.slice(rest.indexOf(':') + 1)
    const slot = pack.frames[fi].parts[pi] as Slot
    const oi = slot.options.indexOf(opt)
    if (oi >= 0) { slot.options.splice(oi, 1); slot.options_en.splice(oi, 1) }
    if (slot.options.length < 2) return false
    open = open.filter((id) => picksById[id].indexOf(worst) < 0)
  }
  return true
}

const words = (s: string) => String(s || '').replace(/[.,!?~]/g, '').trim().split(/\s+/).filter(Boolean)
const sameWords = (a: string, b: string) => words(a).slice().sort().join('|') === words(b).slice().sort().join('|')

// Same rule as _wfHas() in writing-flow.js.
export function hasToken(text: string, token: string): boolean {
  if (token === '@reason') {
    return String(text).split(/[\s.,!?]+/).some((w) => w.length >= 2 && /[가-힣]서$/.test(w) && !/에서$/.test(w))
  }
  return String(text).indexOf(token) >= 0
}

const str = (x: unknown) => typeof x === 'string' && x.trim() !== '' && !EMOJI.test(x)

// Structural checks + deterministic clean-up. Returns errors (empty = ok).
export function validatePack(raw: unknown, level: string): { pack: Pack | null; errors: string[] } {
  const errors: string[] = []
  const c = raw as Pack
  if (!c || typeof c !== 'object') return { pack: null, errors: ['not an object'] }
  if (!c.format || !str(c.format.label) || !str(c.format.hint)) errors.push('format')
  c.min_sentences = MIN_SENTENCES[level] || 3
  if (!Array.isArray(c.models) || c.models.length < 2 || !c.models.every((m) => str(m.ko) && HANGUL.test(m.ko) && str(m.en))) errors.push('models')
  else c.models.forEach((m) => { m.hl = Array.isArray(m.hl) ? m.hl.filter((h) => str(h) && m.ko.indexOf(h) >= 0) : [] })
  if (!Array.isArray(c.patterns) || !c.patterns.length) errors.push('patterns')
  else c.patterns = c.patterns.filter((p) => str(p.name) && str(p.ex_ko) && Array.isArray(p.match) && p.match.some(str))
  if (!Array.isArray(c.frames) || c.frames.length !== 3) errors.push('frames: need exactly 3')
  else c.frames.forEach((f, fi) => {
    if (!Array.isArray(f.parts) || !str(f.en)) { errors.push(`frame ${fi + 1}: shape`); return }
    const slots = f.parts.filter(isSlot)
    if (slots.length !== 1) errors.push(`frame ${fi + 1}: needs exactly one slot`)
    if (!f.parts.every((p) => isSlot(p) || typeof p === 'string')) errors.push(`frame ${fi + 1}: parts`)
    slots.forEach((s) => {
      if (ALLOWED_JOSA.indexOf(s.josa ?? null) < 0) errors.push(`frame ${fi + 1}: josa ${s.josa}`)
      s.josa = s.josa ?? null
      s.ph = '…'
      if (!Array.isArray(s.options) || s.options.length < 3 || s.options.length > 5 || !s.options.every(str)) errors.push(`frame ${fi + 1}: options`)
      if (!Array.isArray(s.options_en) || s.options_en.length !== (s.options || []).length || !s.options_en.every(str)) errors.push(`frame ${fi + 1}: options_en`)
      // The particle is attached automatically — an option must not carry it too.
      if (s.josa === '을/를' && (s.options || []).some((o) => /[을를]$/.test(o))) errors.push(`frame ${fi + 1}: option already carries 을/를`)
    })
  })
  if (!Array.isArray(c.words)) c.words = []
  c.words = c.words.filter(str).slice(0, 10)
  if (!str(c.model_answer) || !HANGUL.test(c.model_answer)) errors.push('model_answer')
  if (!Array.isArray(c.checklist) || c.checklist.length < 2) errors.push('checklist')
  else {
    c.checklist = c.checklist.filter((it) => str(it.label) && Array.isArray(it.any) && it.any.some(str))
    let opt = 0
    c.checklist.forEach((it) => { if (it.optional) { opt++; if (opt > 1) it.optional = false } })
    c.checklist.filter((it) => !it.optional).forEach((it) => {
      if (!it.any.some((t) => hasToken(c.model_answer || '', t))) errors.push(`checklist "${it.label}" not met by model_answer`)
    })
  }
  if (!Array.isArray(c.sentences) || c.sentences.length < 4) errors.push('sentences')
  else {
    c.sentences = c.sentences.filter((s) => str(s.ko) && HANGUL.test(s.ko) && str(s.en))
    c.sentences.forEach((s) => {
      const alts = Array.isArray(s.acceptable_orders) ? s.acceptable_orders : []
      // An alternative must be the same 어절 reordered — anything else is dropped.
      s.acceptable_orders = alts.filter((a) => str(a) && sameWords(a, s.ko) && words(a).join(' ') !== words(s.ko).join(' '))
    })
  }
  const all = JSON.stringify(c)
  if (EMOJI.test(all)) errors.push('emoji')
  return { pack: errors.length ? null : c, errors }
}

// Everything else in the pack the reviewer must read once.
export function sentenceLines(pack: Pack): Line[] {
  const out: Line[] = []
  pack.models.forEach((m, i) => out.push({ id: `M${i + 1}`, text: `${m.ko}  —  "${m.en}"` }))
  pack.patterns.forEach((p, i) => out.push({ id: `T${i + 1}`, text: `[${p.name}: ${p.exp}] ${p.ex_ko}  —  "${p.ex_en}"` }))
  out.push({ id: 'A', text: pack.model_answer })
  pack.sentences.forEach((s, i) => {
    out.push({ id: `S${i + 1}`, text: `${s.ko}  —  "${s.en}"` })
    s.acceptable_orders.forEach((a, k) => out.push({ id: `S${i + 1}.alt${k + 1}`, text: `WORD-ORDER CHECK — original: ${s.ko} | alternative: ${a}  (flag unless the alternative is completely natural with the same meaning)` }))
  })
  pack.frames.forEach((f, i) => {
    const slot = f.parts.find(isSlot) as Slot
    slot.options.forEach((o, k) => out.push({ id: `E${i + 1}.${k + 1}`, text: `GLOSS CHECK — "${o}" = "${slot.options_en[k]}"` }))
  })
  return out
}

// Apply the reviewer's flags to the non-frame parts. false = unusable.
export function applySentenceFlags(pack: Pack, bad: string[], level: string): { ok: boolean; why?: string } {
  const has = (id: string) => bad.indexOf(id) >= 0
  if (has('A')) return { ok: false, why: 'model answer flagged' }
  pack.sentences.forEach((s, i) => { s.acceptable_orders = s.acceptable_orders.filter((_, k) => !has(`S${i + 1}.alt${k + 1}`)) })
  pack.sentences = pack.sentences.filter((_, i) => !has(`S${i + 1}`))
  pack.models = pack.models.filter((_, i) => !has(`M${i + 1}`))
  pack.patterns = pack.patterns.filter((_, i) => !has(`T${i + 1}`))
  for (let i = 0; i < pack.frames.length; i++) {
    const slot = pack.frames[i].parts.find(isSlot) as Slot
    for (let k = slot.options.length - 1; k >= 0; k--) {
      if (has(`E${i + 1}.${k + 1}`)) { slot.options.splice(k, 1); slot.options_en.splice(k, 1) }
    }
    if (slot.options.length < 2) return { ok: false, why: `frame ${i + 1} lost its options` }
  }
  if (pack.sentences.length < 3) return { ok: false, why: 'too few story sentences left' }
  if (!pack.models.length || !pack.patterns.length) return { ok: false, why: 'models/patterns flagged' }
  pack.min_sentences = MIN_SENTENCES[level] || 3
  return { ok: true }
}
