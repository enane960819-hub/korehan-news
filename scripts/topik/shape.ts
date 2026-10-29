// Shared by build.ts and lint.ts: turns a hand-written item into what the
// learner sees (shuffled choices + answer number), so the checker sees
// exactly what gets published.
import { TESTS as BASE, PASSAGES } from './items.mjs'
import { MORE } from './tests/index.mjs'

export const TESTS: any[] = [...BASE, ...MORE]
export { PASSAGES }

// Deterministic shuffle per item so the right answer isn't always ①.
function seeded(str: string) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000 } }

// Tests marked `balance: true` (every test written from now on) get answer
// positions from a plan instead of an independent shuffle per item: each
// position is right about a quarter of the time and never 3 times in a row.
// Older tests keep their seeded order — saved attempts store the chosen
// position, so reshuffling them would rewrite learners' past results.
const plans = new Map<string, number[]>()
function answerPlan(t: any): number[] {
  if (plans.has(t.id)) return plans.get(t.id)!
  const r = seeded(t.id + ':plan')
  const n = t.items.length
  const plan: number[] = []
  while (plan.length < n) {
    const block = [1, 2, 3, 4]
    for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [block[i], block[j]] = [block[j], block[i]] }
    // avoid a third same answer in a row across block edges
    if (plan.length >= 2 && plan[plan.length - 1] === plan[plan.length - 2] && block[0] === plan[plan.length - 1]) block.push(block.shift()!)
    plan.push(...block)
  }
  plans.set(t.id, plan.slice(0, n))
  return plans.get(t.id)!
}

export type Shaped = {
  id: string; test: any; it: any; choices: string[]; answer: number
  passage: string | null; script: { s: string; t: string }[] | null; group: string | null
}

export function shape(t: any, it: any): Shaped {
  const id = `${t.id}-${it.n}`
  let choices: string[], answer: number
  if (it.fixed) { choices = it.choices; answer = it.ans }
  else {
    if (!it.a || !Array.isArray(it.w) || it.w.length !== 3) throw new Error('bad item ' + id)
    const all = [it.a, ...it.w]
    const r = seeded(id)
    if (t.balance) {
      const w = [1, 2, 3]
      for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [w[i], w[j]] = [w[j], w[i]] }
      answer = answerPlan(t)[t.items.indexOf(it)]
      choices = []
      for (let pos = 1, k = 0; pos <= 4; pos++) choices.push(pos === answer ? all[0] : all[w[k++]])
    } else {
      const order = [0, 1, 2, 3]
      for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
      choices = order.map((i) => all[i]); answer = order.indexOf(0) + 1
    }
  }
  // Hand-written tests in tests/*.mjs carry p (passage) / s (script lines
  // [['남','…'],['여','…']]) on the item itself; older items use PASSAGES[g].
  const passage = it.p != null ? it.p : (it.g && !it.s ? (PASSAGES as any)[it.g] ?? null : null)
  const script = it.s ? it.s.map((l: any) => ({ s: l[0] === '남' ? '남자' : l[0] === '여' ? '여자' : l[0], t: l[1] })) : null
  const group = it.g ? (t.id.startsWith('t1-') ? it.g : `${t.id}-${it.g}`) : null
  return { id, test: t, it, choices, answer, passage, script, group }
}
