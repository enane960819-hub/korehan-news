// Revised Romanization of Korean, computed from the Hangul with the main
// pronunciation rules (liaison, final-consonant neutralization,
// nasalization, ㄹ assimilation, ㅎ aspiration/drop, palatalization).
// Used as a cross-check for stored romanizations: AI- or PDF-written values
// drifted (파란색 "paramsaek"). It is a check, not an oracle — irregular
// compounds (ㄴ insertion etc.) differ, so a mismatch goes to the reviewer
// rather than being overwritten blindly.

const CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
const JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
// Final consonants as jamo index into CHO-like letters (jong table order).
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const CHO_JAMO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
// Compound finals: [stays, moves to the next syllable before a vowel]
const SPLIT: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
}
// Sound class of a final before a consonant.
function finalClass(j: string): string {
  if (!j) return ''
  if ('ㄱㄲㅋㄳㄺ'.includes(j)) return 'k'
  if ('ㄴㄵㄶ'.includes(j)) return 'n'
  if ('ㄷㅅㅆㅈㅊㅌㅎ'.includes(j)) return 't'
  if ('ㄹㄼㄽㄾㅀ'.includes(j)) return 'l'
  if ('ㅁㄻ'.includes(j)) return 'm'
  if ('ㅂㅍㅄㄿ'.includes(j)) return 'p'
  if (j === 'ㅇ') return 'ng'
  return ''
}

type Syl = { cho: string; jung: number; jong: string } | { raw: string }

export function romanize(text: string): string {
  const syls: Syl[] = []
  for (const ch of String(text || '')) {
    const c = ch.charCodeAt(0) - 0xAC00
    if (c < 0 || c > 11171) { syls.push({ raw: ch }); continue }
    syls.push({ cho: CHO_JAMO[Math.floor(c / 588)], jung: Math.floor((c % 588) / 28), jong: JONG[c % 28] })
  }
  // Pass 1: sound changes between syllables (within a word).
  for (let i = 0; i < syls.length - 1; i++) {
    const a = syls[i] as any, b = syls[i + 1] as any
    if (a.raw !== undefined || b.raw !== undefined || !a.jong) continue
    // ㅎ final: aspirates the next ㄱㄷㅈ, drops before a vowel/ㄴ
    if (a.jong === 'ㅎ' || a.jong === 'ㄶ' || a.jong === 'ㅀ') {
      const keep = a.jong === 'ㅎ' ? '' : (a.jong === 'ㄶ' ? 'ㄴ' : 'ㄹ')
      if (b.cho === 'ㄱ') { b.cho = 'ㅋ'; a.jong = keep; continue }
      if (b.cho === 'ㄷ') { b.cho = 'ㅌ'; a.jong = keep; continue }
      if (b.cho === 'ㅈ') { b.cho = 'ㅊ'; a.jong = keep; continue }
      if (b.cho === 'ㅇ') { a.jong = keep; if (keep) { b.cho = keep; a.jong = '' } continue }
      if (b.cho === 'ㄴ' && a.jong === 'ㅎ') { a.jong = 'ㄴ'; continue }
    }
    // ㄱㄷㅂㅈ final + ㅎ → aspirated
    if (b.cho === 'ㅎ') {
      const cls = finalClass(a.jong)
      if (cls === 'k') { a.jong = SPLIT[a.jong] ? SPLIT[a.jong][0] : ''; b.cho = 'ㅋ'; continue }
      if (cls === 't' && a.jong !== 'ㅎ') { a.jong = ''; b.cho = (b.jung === 20 ? 'ㅊ' : 'ㅌ'); continue }
      if (cls === 'p') { a.jong = SPLIT[a.jong] ? SPLIT[a.jong][0] : ''; b.cho = 'ㅍ'; continue }
    }
    // Liaison: final moves onto a following ㅇ
    if (b.cho === 'ㅇ') {
      if (a.jong === 'ㅇ') continue
      let move = a.jong
      if (SPLIT[a.jong]) { a.jong = SPLIT[a.jong][0]; move = SPLIT[move][1] } else a.jong = ''
      // Palatalization: ㄷ/ㅌ + 이 → 지/치
      if (b.jung === 20 && move === 'ㄷ') move = 'ㅈ'
      if (b.jung === 20 && move === 'ㅌ') move = 'ㅊ'
      b.cho = move
      continue
    }
    const cls = finalClass(a.jong)
    // Nasalization before ㄴ/ㅁ
    if (b.cho === 'ㄴ' || b.cho === 'ㅁ') {
      if (cls === 'k') a.jong = 'ㅇ'
      else if (cls === 't') a.jong = 'ㄴ'
      else if (cls === 'p') a.jong = 'ㅁ'
      else if (cls === 'l' && b.cho === 'ㄴ') { a.jong = 'ㄹ'; b.cho = 'ㄹ' }
      continue
    }
    if (b.cho === 'ㄹ') {
      if (cls === 'n' || cls === 'l') { a.jong = 'ㄹ'; continue }         // 신라 → silla
      if (cls === 'm' || cls === 'ng') { b.cho = 'ㄴ'; continue }         // 종로 → jongno
      if (cls === 'k') { a.jong = 'ㅇ'; b.cho = 'ㄴ'; continue }          // 국립 → gungnip
      if (cls === 'p') { a.jong = 'ㅁ'; b.cho = 'ㄴ'; continue }
      if (cls === 't') { a.jong = 'ㄴ'; b.cho = 'ㄴ'; continue }
    }
  }
  // Pass 2: letters.
  let out = ''
  for (let i = 0; i < syls.length; i++) {
    const s = syls[i] as any
    if (s.raw !== undefined) { out += s.raw; continue }
    const prev = syls[i - 1] as any
    let c = CHO[CHO_JAMO.indexOf(s.cho)]
    // ㄹ initial after ㄹ final is "l" (ll); elsewhere "r"
    if (s.cho === 'ㄹ' && prev && prev.raw === undefined && prev.jong === 'ㄹ') c = 'l'
    out += c + JUNG[s.jung]
    const cls = finalClass(s.jong)
    out += cls === 'ng' ? 'ng' : cls
  }
  return out
}

// Loose comparison: case, spaces, hyphens and apostrophes don't matter.
export function romKey(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '')
}
