# Weekly Phrase Munch + Key Expressions (hand-written)

Owner rule (2026-10-30): every Friday, write the NEXT week's Phrase Munch lessons and Key
Expressions for each open level (Starter = Seed, Beginner = Sprout, Intermediate = Tree; Forest
is locked) instead of letting the first learner trigger an unreviewed browser AI generation.
No paid AI calls.

1. **Topics.** Read next Monday's `study_daily_content` rows (`scheduled_date` = that Monday,
   one per level; `daily-content-gen` creates them nightly for this week + next week). The table
   is not readable as anon: sign in with the QA account (REST `auth/v1/token`) and select
   `scheduled_date,level,topic_ko,topic_en,phrase_munch_lessons,key_expressions`. If a row is
   missing, write nothing for that level and say so.
2. **Write** `weeks/<monday>.mjs` exporting `ROWS` in the same shape as `content.mjs` (read its
   header comment): 3 Phrase Munch lessons + 6 Key Expressions per level, on that level's topic.
   - Phrase Munch `example.ko` is a word-order puzzle (first word given, exact order judged):
     after the first word only one order may be natural.
   - `practice.choices[0]` is the answer; the other three must be clearly wrong in the slot
     (ungrammatical or a different meaning/tense), never an acceptable alternative.
   - Key Expressions: keep the `~` slot at the start or end so the fill answer is contiguous in
     `examples[0].ko`; give each expression a differently shaped fill answer.
   - 해요체, natural Korean, psych verbs in 3rd person take -아/어 하다, no emoji.
3. **Build + lint:** `node --experimental-strip-types scripts/study-week/build.ts scripts/study-week/weeks/<monday>.mjs --table`
   — fix every lint error; read the `--table` output (each fill blank with the other answers
   dropped in) and make sure no other answer fits the English.
4. **Independent review:** have a separate reviewer agent read the week file (naturalness,
   translations, glosses, grammar notes, distractors, word-order uniqueness) and apply what it finds.
5. **Ship:** commit the week file + the generated `supabase/migrations/<today>_study_week_<monday>.sql`,
   PR, merge. `apply-migrations` fills only empty columns. Check the six counts with the REST query
   from step 1 (3 lessons / 6 expressions per row), then open Phrase Munch and Key Expressions on
   korehani.com for that week once it starts.
