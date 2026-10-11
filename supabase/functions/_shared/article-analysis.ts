// Sentence-by-sentence article analysis shared by daily-article-draft
// (bakes drafts at creation) and article-analyze (first signed-in reader
// bakes an older article on demand). One place for the prompt, the
// sentence splitter (must match _khWrapSentences in korehan-shared.js) and
// the Vocab/Grammar tab derivation, so both paths write the same cache.

export type Level = 'Starter' | 'Beginner' | 'Intermediate' | 'Advanced'
export const SENT_CACHE_VERSION = 's6' // = SENT_CACHE_CURRENT in the admin CMS
const LEVEL_LABEL: Record<Level, string> = { Starter: 'Seed', Beginner: 'Sprout', Intermediate: 'Tree', Advanced: 'Forest' }

export function extractJsonObject(raw: string): any {
  let clean = String(raw || '').replace(/```json?/g, '').replace(/```/g, '').trim()
  const s = clean.indexOf('{')
  if (s < 0) throw new Error('No JSON object in response')
  let depth = 0, inStr = false, esc = false, e = -1
  for (let i = s; i < clean.length; i++) {
    const ch = clean[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) { e = i; break } }
  }
  // e < 0 → truncated mid-object: keep the whole tail so the salvage
  // below can close it after the last complete array item.
  clean = e < 0 ? clean.slice(s) : clean.slice(s, e + 1)
  try { return JSON.parse(clean) } catch (_) { /* repair below */ }
  const repaired = clean.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f]+/g, ' ')
  try { return JSON.parse(repaired) } catch (_) { /* truncation salvage below */ }
  // Truncated array of objects ({"sentences":[{..},{..},{..) → keep complete items.
  let cut = repaired.lastIndexOf('},')
  while (cut > 0) {
    try { return JSON.parse(repaired.slice(0, cut + 1) + ']}') } catch (_) { cut = repaired.lastIndexOf('},', cut - 1) }
  }
  throw new Error('JSON parse failed after repair')
}


export function analysisPrompt(title: string, body: string, level: Level): string {
  const low = level === 'Starter' || level === 'Beginner'
  return '당신은 한국어 학습자를 위한 문장 단위 분석가입니다. 아래 한국어 기사 본문에 대해 문장별로 vocab + 문법/표현 분석을 생성해 주세요.\n\n'
    + '[기사 제목]\n' + title + '\n\n[기사 본문 (단락 \\n\\n 구분)]\n' + body + '\n\n'
    + '[학습자 레벨]\n' + LEVEL_LABEL[level] + ' (' + level + ')\n\n'
    + '[문장별 분석]\n'
    + '- 본문에 등장하는 모든 한국어 문장을 등장 순서대로 추출.\n'
    + '- text: 본문에 EXACTLY 등장한 형태 그대로 (마침표/물음표 포함).\n'
    + '- translation: 폴리시된 영어 번역 (같은 주어, 같은 시제, 같은 격식). 한국어에 없는 I/we 주어 추가 금지.\n'
    + '- vocab: max 4. 사전형으로 (✓잡다 ✗잡았어요). ' + (low ? '입문/초급 단어도 포함 OK.' : '입문 단어(는/이/가/이다/있다/하다/되다)는 스킵.') + ' 빈 배열 OK.\n'
    + '- analysis: ' + (low ? 'max 6 items.' : 'max 4 items.') + ' 각 항목:\n'
    + '    type: "grammar" | "expression" | "idiom"\n'
    + '    label: 패턴/표현 자체 (canonical, 예: "~았/었어요"). grammar는 형태소/연결어미/활용 종류만. 명사 X.\n'
    + '    exp: 1-2줄 영어 설명. morpheme이 무엇을 하는지 + 사전형 → 활용형 chain.\n'
    + '    example_in_sentence: 이 문장의 literal substring chunk.\n'
    + '- 본문에 없는 패턴 절대 금지. 확실하지 않으면 생략.\n'
    + '- expression/idiom은 그 문장 의미에 핵심일 때만.\n\n'
    + '[출력 — JSON ONLY, no preamble, no code fences]\n'
    + '{"sentences":[{"text":"<exact KO sentence>","translation":"<EN>","vocab":[{"ko":"...","en":"..."}],"analysis":[{"type":"grammar","label":"...","exp":"...","example_in_sentence":"..."}]}]}'
}


// Same splitter as _khSplitSentencesForCache (admin) / _khWrapSentences (reader).
export function splitSentences(body: string): string[] {
  const out: string[] = []
  String(body || '').split(/\n\n+/).forEach((para) => {
    para.split(/\n+/).forEach((piece) => {
      const trimmed = piece.trim()
      if (!trimmed) return
      trimmed.replace(/([.!?。])\s+/g, '$1\u0001').split('\u0001').forEach((s) => {
        const st = s.trim()
        if (st) out.push(st)
      })
    })
  })
  return out
}

export function canonGrammarKey(label: string): string {
  let s = String(label || '').trim()
  s = s.replace(/\s*\([^)]*[a-zA-Z][^)]*\)\s*$/, '').trim()
  s = s.replace(/\(서\)$/, '').replace(/서$/, '').trim()
  return s.replace(/\s+/g, ' ').toLowerCase()
}

// Port of _khDeriveVocabGrammarFromSentences (admin) — Vocab + Grammar tabs.
export function deriveTabs(sentences: any[], level: Level) {
  const vocabSeen: Record<string, true> = {}
  const vocab: any[] = []
  const byKey: Record<string, any> = {}
  const grammar: any[] = []
  for (const s of sentences) {
    for (const v of (s.vocab || [])) {
      const ko = String(v?.ko || '').trim()
      if (!ko || vocabSeen[ko]) continue
      vocabSeen[ko] = true
      vocab.push({ ko, en: String(v.en || '').trim(), note: String(v.note || '').trim() })
    }
    for (const a of (s.analysis || [])) {
      if (!a || (a.type || 'grammar') !== 'grammar') continue
      const name = String(a.label || '').trim()
      const key = canonGrammarKey(name)
      if (!key) continue
      const exp = String(a.exp || '').trim()
      if (byKey[key]) {
        if (name.length > byKey[key].name.length) byKey[key].name = name
        if (exp.length > (byKey[key].exp || '').length) byKey[key].exp = exp
        continue
      }
      byKey[key] = { name, level, exp, ex_ko: s.text, ex_en: s.translation || '' }
      grammar.push(byKey[key])
    }
  }
  return { vocab: vocab.slice(0, 100), grammar: { patterns: grammar.slice(0, 15) } }
}

// Align the model's sentences to our own split of the body (the reader's
// tap targets) and keep only well-formed fields.
export function stitchSentences(body: string, rawSents: any[]) {
  return splitSentences(body).map((text, idx) => {
    let m = rawSents.find((s) => {
      const t = String(s?.text || '').trim()
      return t && (t === text || text.includes(t) || t.includes(text))
    })
    if (!m) m = rawSents[idx] || {}
    return {
      text,
      translation: typeof m.translation === 'string' ? m.translation : '',
      vocab: (Array.isArray(m.vocab) ? m.vocab : []).filter((v: any) => v && v.ko).slice(0, 4),
      analysis: (Array.isArray(m.analysis) ? m.analysis : [])
        .filter((a: any) => a && (a.label || a.pattern)).slice(0, 8)
        .map((a: any) => ({ type: a.type || 'grammar', label: a.label || a.pattern, exp: a.exp || '', example_in_sentence: a.example_in_sentence || '' })),
    }
  })
}
