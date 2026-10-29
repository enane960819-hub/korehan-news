# TOPIK practice — review before anything goes live

Owner rule (2026-10-29): every mock-test question is reviewed thoroughly before
learners see it. A test passes three stages, in order.

## 1. Automatic checks — `lint.ts` (runs inside `build.ts`)

`node --experimental-strip-types scripts/topik/lint.ts [test-id …]`

The build refuses to write the seed while any **error** is left:

- question numbers and types match the real TOPIK layout (`_shared/topik-spec.ts`)
- four non-empty, different choices; a valid answer; ㉠㉡㉢㉣ for insert items
- listening items have a script, reading items a passage, set items their own question
- every item has an explanation; picture choices start with `그림:`; blanks have `(    )`
- tests marked `balance: true`: each answer number is right 18–32% of the time and
  never three times in a row

**Warnings** go to the human reviewer: double spaces, unbalanced brackets, an answer
copied word-for-word from the text, the answer being the longest choice too often,
the same passage used twice in the bank, every sentence-order answer opening with the same label.

Every new test sets `balance: true`. Older tests keep their order because saved
attempts store the chosen position.

## 2. Independent second review

A reviewer who did not write the test reads every item, not a sample. Give them a
package with the rendered item (passage/script, printed question, numbered choices,
answer, explanation). Tell them nothing about suspected problems except lint warnings.
They check, for each item:

1. exactly one defensible answer, and the key is right
2. every distractor is clearly wrong in the slot (not partly true, not a narrower answer)
3. natural, correct Korean: spelling, 띄어쓰기, particles, register; scripts sound spoken
4. level fit for the level and the question number
5. no give-aways: copied sentences in "matches" items, the only choice in a different
   form, the longest or most specific choice, absurd distractors
6. the explanation is accurate and says why
7. the item follows the real TOPIK format for its number

Every `error` and `fix` finding is applied (or answered with a reason) and the test
is reviewed again until nothing is left at those levels.

## 3. Admin approval in the app

New tests are seeded as **drafts** (`status = 'draft'`, hidden from learners by RLS).
On `korehan-topik.html` the admin opens *Admin · review → Review*: every question with
its answer and explanation, and a *Flag a problem* button. A test with any flagged
question cannot be published. *Approve & publish* stamps `approved_at`; *Move to
draft* pulls a live test at once.

Learners can *Report a problem with this question* from their mistakes list
(`topik_reports`); open reports show in the same admin panel.
