// TOPIK practice — automatic checks (stage 1 of the review; see REVIEW.md).
// node --experimental-strip-types scripts/topik/lint.ts [test-id ...]
// Errors fail the build (build.ts runs this first); warnings are printed for
// the human reviewer to look at, item by item.
import { SPEC } from '../../supabase/functions/_shared/topik-spec.ts'
import { TESTS, shape } from './shape.ts'

type Finding = { level: 'error' | 'warn'; id: string; msg: string }

const HANGUL = /[가-힣]/
// Older tests (t1-*) tag set questions by what they ask; topik.js prints a
// built-in question line for these, so they need no q of their own.
const LEGACY_SET_TYPES = new Set(['pblank', 'pmatch', 'ptopic', 'purpose', 'infer', 'insert'])
const norm = (s: string) => s.replace(/\s+/g, '').replace(/[.,!?~·]/g, '')

function blockFor(level: string, section: string, n: number) {
  const sec = SPEC[`${level}-${section}`]
  if (!sec) return null
  for (const b of sec.chunks.flat()) if (n >= b.from && n <= b.to) return b
  return null
}

// Text hygiene for any learner-facing string.
function textIssues(s: string): string[] {
  const out: string[] = []
  if (s !== s.trim()) out.push('leading/trailing space')
  if (/ {2,}/.test(s.replace(/\(\s{2,}\)/g, '()'))) out.push('double space')
  const pairs: [string, string][] = [['(', ')'], ['[', ']'], ['“', '”'], ['‘', '’'], ['「', '」']]
  for (const [o, c] of pairs) if (s.split(o).length !== s.split(c).length) out.push(`unbalanced ${o}${c}`)
  if ((s.match(/"/g) || []).length % 2) out.push('odd number of "')
  if (/[①②③④]/.test(s)) out.push('choice marker inside text')
  if (/\[u\]/.test(s) !== /\[\/u\]/.test(s)) out.push('unclosed [u]')
  return out
}

export function lint(onlyIds: string[] = []): Finding[] {
  const F: Finding[] = []
  const err = (id: string, msg: string) => F.push({ level: 'error', id, msg })
  const warn = (id: string, msg: string) => F.push({ level: 'warn', id, msg })
  const stems = new Map<string, string>()     // normalized stem/passage → first id (duplicates across tests)

  for (const t of TESTS) {
    if (onlyIds.length && !onlyIds.includes(t.id)) continue
    const sec = SPEC[`${t.level}-${t.section}`]
    if (!sec) { err(t.id, `no spec for ${t.level}-${t.section}`); continue }
    const ns = t.items.map((it: any) => it.n)

    // Layout: a full test covers the real numbering exactly, in order.
    if (t.kind === 'full') {
      const want: number[] = []
      for (const b of sec.chunks.flat()) for (let n = b.from; n <= b.to; n++) want.push(n)
      if (ns.join(',') !== want.join(',')) err(t.id, `numbers ${ns[0]}–${ns[ns.length - 1]} (${ns.length}) do not match the TOPIK layout ${want[0]}–${want[want.length - 1]} (${want.length})`)
    }
    if (new Set(ns).size !== ns.length) err(t.id, 'duplicate question numbers')

    const shaped = t.items.map((it: any) => shape(t, it))
    const answers: number[] = []
    let longest = 0

    for (const x of shaped) {
      const { id, it, choices, answer } = x
      answers.push(answer)
      const b = blockFor(t.level, t.section, it.n)
      // Mini drills number from 1 and mix types; full tests follow the paper.
      const setBlock = b && (b.set || 1) > 1
      if (t.kind === 'full') {
        if (!b) err(id, `number ${it.n} is outside the ${t.level}-${t.section} layout`)
        else if (b.type !== it.t && !(setBlock && (it.q || LEGACY_SET_TYPES.has(it.t)))) err(id, `type "${it.t}" but TOPIK ${t.level} ${t.section} #${it.n} is "${b.type}"`)
      }

      // Choices
      if (choices.length !== 4) err(id, `${choices.length} choices`)
      if (choices.some((c) => !c || !String(c).trim())) err(id, 'empty choice')
      if (new Set(choices.map(norm)).size !== choices.length) err(id, 'two choices are the same (ignoring spaces/punctuation)')
      if (!(answer >= 1 && answer <= 4)) err(id, `answer ${answer} out of range`)
      const isInsert = it.t === 'insert' || (b && b.choices === 'insert' && (b.type === 'insert' || it.n === b.from))
      if (isInsert && choices.join() !== '㉠,㉡,㉢,㉣') err(id, 'insert question must use ㉠㉡㉢㉣ in order')

      // Content present for the type
      if (sec.listening && !x.script) err(id, 'listening item without a script')
      if (!sec.listening && it.n > 0 && !x.passage && !it.q) err(id, 'reading item without passage or question')
      if (t.kind === 'full' && setBlock && !it.q && !LEGACY_SET_TYPES.has(it.t)) err(id, 'set question without its own question line (q)')
      if (!it.e || String(it.e).trim().length < 12) err(id, 'missing or too-short explanation (e)')
      if (b && b.type === 'l_picture' && !choices.every((c) => /^그림:/.test(c))) err(id, 'picture choices must start with "그림:"')
      if (b && b.type === 'blank' && x.passage && !/\(\s*\)/.test(x.passage)) err(id, 'blank question without "(    )" in the passage')

      // Hygiene on every learner-facing string
      const texts: [string, string][] = [['passage', x.passage || ''], ['question', it.q || ''], ['instruction', it.ins || ''],
        ...choices.map((c, i) => [`choice ${i + 1}`, c] as [string, string]),
        ...(x.script || []).map((l, i) => [`script line ${i + 1}`, l.t] as [string, string])]
      for (const [where, s] of texts) for (const p of textIssues(s)) warn(id, `${where}: ${p}`)
      for (const c of choices) if (!HANGUL.test(c) && !/^[㉠㉡㉢㉣]$/.test(c) && !/^\(가\)/.test(c) && !/^[\d,.%~\s원명개시분년월일]+$/.test(c)) warn(id, `choice without Korean: "${c}"`)

      // Give-aways
      const ans = choices[answer - 1] || ''
      const lens = choices.map((c) => c.length)
      if (lens[answer - 1] === Math.max(...lens) && lens.filter((l) => l === lens[answer - 1]).length === 1 && ans.length > 6) longest++
      const body = norm((x.passage || '') + (x.script || []).map((l) => l.t).join(''))
      if (ans.length >= 10 && b && /match|l_match|set|l_set/.test(b.type) && body.includes(norm(ans))) warn(id, 'right answer is copied word-for-word from the text (too easy?)')

      // Duplicate passages/stems across the whole bank
      const key = norm((x.passage || '') + (it.q || '') + (x.script || []).map((l) => l.t).join(''))
      if (key.length > 20 && !x.group) {
        if (stems.has(key)) warn(id, `same text as ${stems.get(key)}`)
        else stems.set(key, id)
      }
    }

    // Sentence-order items: the right order must not always open with the same label.
    const firsts = shaped.filter((x: any) => x.it.t === 'order').map((x: any) => (x.choices[x.answer - 1] || '').match(/\((가|나|다|라)\)/)?.[1]).filter(Boolean)
    if (firsts.length >= 2 && new Set(firsts).size === 1) warn(t.id, `every sentence-order answer starts with (${firsts[0]}) — learners can guess the pattern`)

    // Answer pattern across the test
    const n = answers.length
    if (n >= 12) {
      const counts = [1, 2, 3, 4].map((k) => answers.filter((a) => a === k).length)
      const pattern = t.balance ? err : warn   // balanced tests control positions, so a skew there is a bug
      counts.forEach((c, i) => { if (c / n < 0.15 || c / n > 0.35) pattern(t.id, `answer ${i + 1} is right in ${c}/${n} questions (aim for 18–32%)`) })
      let run = 1
      for (let i = 1; i < n; i++) { run = answers[i] === answers[i - 1] ? run + 1 : 1; if (run === (t.balance ? 3 : 4)) pattern(t.id, `answer ${answers[i]} ${run} times in a row ending at #${t.items[i].n}`) }
      if (longest / n > 0.4) warn(t.id, `the right answer is the longest choice in ${longest}/${n} questions (test-wise learners will guess)`)
    }
  }
  return F
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const F = lint(process.argv.slice(2))
  const e = F.filter((f) => f.level === 'error'), w = F.filter((f) => f.level === 'warn')
  for (const f of [...e, ...w]) console.log(`${f.level === 'error' ? 'ERROR' : 'warn '} ${f.id}: ${f.msg}`)
  console.log(`\n${e.length} error(s), ${w.length} warning(s)`)
  process.exit(e.length ? 1 : 0)
}
