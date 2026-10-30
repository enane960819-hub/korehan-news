// node --experimental-strip-types scripts/study-week/build.ts
// Lints content.mjs and writes the fill-only migration.
import { writeFileSync } from 'node:fs'
import { ROWS } from './content.mjs'
import { romanize } from '../../supabase/functions/_shared/romanize.ts'

const errs: string[] = []
const bad = (m: string) => errs.push(m)
const strip = (p: string) => String(p || '').replace(/~[^\s]*/g, '').replace(/\bV\b/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^[을를이가의에서와과도만으로부터까지에게한테로써\s/]+/, '').trim()   // = _keStripPatternForFill
const bare = (s: string) => s.replace(/[\s.,!?]/g, '')
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

for (const r of ROWS) {
  const id = r.date + ' ' + r.level
  if (r.pm.length !== 3) bad(id + ': need 3 lessons')
  r.pm.forEach((l: any, i: number) => {
    for (const k of ['example', 'practice']) {
      const s = l[k]
      if (!s?.ko || !s?.en || !Array.isArray(s.parts) || !s.parts.length) { bad(`${id} pm${i} ${k}: missing fields`); continue }
      if (bare(s.parts.map((p: any) => p.ko).join('')) !== bare(s.ko)) bad(`${id} pm${i} ${k}: parts don't spell "${s.ko}"`)
    }
    if (l.example.ko.replace(/[.!?]/g, '').split(/\s+/).length < 3) bad(`${id} pm${i}: example too short for the word-order step`)
    if (!l.example.grammar_note) bad(`${id} pm${i}: no grammar_note`)
    const c = l.practice.choices
    if (!Array.isArray(c) || c.length !== 4 || new Set(c).size !== 4) bad(`${id} pm${i}: need 4 distinct choices`)
    else if (c[0] !== l.practice.ko) bad(`${id} pm${i}: choices[0] must be practice.ko`)
  })
  if (r.ke.length !== 6) bad(id + ': need 6 expressions')
  const cores = r.ke.map((e: any) => strip(e.ko))
  if (new Set(cores).size !== cores.length) bad(id + ': two expressions share a fill answer')
  r.ke.forEach((e: any, i: number) => {
    if (!e.ko.includes('~')) bad(`${id} ke${i}: pattern has no ~ slot`)
    if (!(e.parts?.length >= 2 && e.parts.length <= 4)) bad(`${id} ke${i}: 2-4 parts`)
    if (e.examples?.length !== 2) bad(`${id} ke${i}: 2 examples`)
    if (!cores[i] || !e.examples[0].ko.includes(cores[i])) bad(`${id} ke${i}: fill answer "${cores[i]}" not in "${e.examples[0].ko}"`)
    // Romanize word by word; keep the ~ slot and spell the bare jamo endings.
    e.rom = e.ko.split(/\s+/).map((w: string) => {
      const lead = w.startsWith('~') ? '~' : '', tail = w.endsWith('~') && w.length > 1 ? '~' : ''
      const core = w.replace(/^~|~$/g, '')
      return lead + (core ? romanize(core).replace(/ㄴ/g, 'n').replace(/ㄹ/g, 'l') : '') + tail
    }).join(' ')
  })
  if (EMOJI.test(JSON.stringify(r))) bad(id + ': emoji')
}

// Review table: each fill blank with the other answers dropped in.
if (process.argv.includes('--table')) for (const r of ROWS) {
  console.log('\n## ' + r.date + ' ' + r.level)
  const cores = r.ke.map((e: any) => strip(e.ko))
  r.ke.forEach((e: any, i: number) => {
    console.log(`  [${e.examples[0].en}]`)
    cores.forEach((c: string, j: number) => console.log(`    ${j === i ? 'OK ' : '   '} ${e.examples[0].ko.split(cores[i]).join(c)}`))
  })
}

if (errs.length) { console.error(errs.join('\n')); process.exit(1) }

const q = (v: unknown) => '$j$' + JSON.stringify(v) + '$j$'
let sql = `-- auto-apply
-- Hand-written Phrase Munch lessons + Key Expressions for the study weeks of
-- 2026-10-26 and 2026-11-02 (owner 2026-10-30). Those rows had none, so the
-- first learner to open either step started an unreviewed browser AI
-- generation. Written in scripts/study-week/content.mjs, linted and built by
-- build.ts. Fill-only: a row that already has content is left alone.
`
for (const r of ROWS) {
  const where = `scheduled_date = '${r.date}' and level = '${r.level}'`
  sql += `\nupdate public.study_daily_content set phrase_munch_lessons = ${q(r.pm)}\n where ${where}\n   and (phrase_munch_lessons is null or phrase_munch_lessons::text in ('[]', 'null'));\n`
  sql += `update public.study_daily_content set key_expressions = ${q(r.ke.map((e: any) => ({ ko: e.ko, rom: e.rom, en: e.en, parts: e.parts, examples: e.examples })))}\n where ${where}\n   and (key_expressions is null or key_expressions::text in ('[]', 'null'));\n`
}
writeFileSync(new URL('../../supabase/migrations/20261030_study_week_content.sql', import.meta.url), sql)
console.log('ok:', ROWS.length, 'rows')
