-- essential_expressions: pool of high-value Korean phrases / idioms /
-- formulas learners should encounter repeatedly in conversation.
--
-- Design: separate from hover_vocab_master / vocabulary_bank because
-- those are dictionary entries (single words / definitions). Essential
-- expressions are MULTI-WORD chunks with a usage context — "잘
-- 부탁드립니다", "신경 써주셔서 감사해요", "큰일 났어요". They get
-- woven into generated conversations by the conv-gen prompt, so
-- learners hit the same expressions naturally over many scenes
-- instead of memorizing isolated lists.
--
-- Per owner: "필수표현같은거 Db 만들어서 대화에 포함시키는걸로 가보자".
--
-- RLS: anon read active rows; admin writes via service role (admin
-- UI lands in a follow-up PR).

CREATE TABLE IF NOT EXISTS public.essential_expressions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ko            text NOT NULL,
  en            text NOT NULL,
  level         text NOT NULL,             -- 's' | 'b' | 'i' | 'a'
  category      text,                      -- greeting | gratitude | apology | agreement | request | emotion | filler | etc.
  context_hint  text,                      -- when/how to use, optional
  sort_order    int  NOT NULL DEFAULT 100,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS essential_expressions_level_active_idx
  ON public.essential_expressions (level, active, sort_order);

ALTER TABLE public.essential_expressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "essential_expressions public read" ON public.essential_expressions;
CREATE POLICY "essential_expressions public read"
  ON public.essential_expressions FOR SELECT TO public
  USING (active = true);

-- Seed: ~40 high-value expressions across Beginner → Advanced. Picked
-- to cover the conversational glue learners need across the cat
-- buckets (everyday / work / friends / family / dating). Admin can
-- add / edit / disable via the management UI.
INSERT INTO public.essential_expressions (ko, en, level, category, context_hint, sort_order) VALUES
  -- Beginner — greeting / closing / acknowledgement
  ('잘 부탁드립니다',          'Please take care of me / Looking forward to working with you',  'b', 'greeting',   'First meeting, joining a team, asking for help',  10),
  ('수고하셨습니다',           'Good work / Thanks for your effort',                            'b', 'closing',    'End of a workday or task',                        20),
  ('괜찮아요',                  'It''s okay / No worries',                                       'b', 'reassurance',NULL,                                              30),
  ('맞아요',                    'That''s right',                                                 'b', 'agreement',  NULL,                                              40),
  ('아니에요',                  'No / Not at all',                                               'b', 'denial',     'Polite deflection of thanks or compliment',       50),
  ('그래요',                    'Really? / Is that so?',                                         'b', 'agreement',  NULL,                                              60),
  ('잠깐만요',                  'Hold on a moment',                                              'b', 'request',    NULL,                                              70),
  ('죄송합니다',                'I''m sorry (formal)',                                           'b', 'apology',    NULL,                                              80),
  ('미안해요',                  'Sorry (casual)',                                                'b', 'apology',    NULL,                                              90),
  ('고마워요',                  'Thanks (casual)',                                               'b', 'gratitude',  NULL,                                             100),
  -- Intermediate — emotion / opinion / softening
  ('신경 써주셔서 감사해요',     'Thanks for thinking of me',                                     'i', 'gratitude',  'Acknowledging a small kindness',                 110),
  ('덕분이에요',                'Thanks to you / Because of you',                                'i', 'gratitude',  NULL,                                             120),
  ('큰일 났어요',               'Something terrible happened / Big problem',                     'i', 'emotion',    'Reacting to bad news, exaggeration ok',          130),
  ('어쩔 수 없어요',            'There''s nothing we can do / It can''t be helped',              'i', 'resignation',NULL,                                             140),
  ('마음에 들어요',             'I like it (it suits my taste)',                                 'i', 'opinion',    NULL,                                             150),
  ('그럴 줄 알았어요',           'I knew it would be like that',                                  'i', 'reaction',   NULL,                                             160),
  ('생각해 볼게요',             'I''ll think about it',                                          'i', 'softening',  'Polite non-commitment',                          170),
  ('아무래도',                  'Probably / It seems like',                                      'i', 'filler',     'Softening a guess or opinion',                   180),
  ('그러게요',                  'Yeah, I know (agreeing with frustration)',                      'i', 'agreement',  NULL,                                             190),
  ('말도 안 돼요',              'No way / That doesn''t make sense',                             'i', 'reaction',   'Shock or disbelief',                             200),
  ('어차피',                    'Anyway / In any case',                                          'i', 'filler',     NULL,                                             210),
  ('그건 그렇고',               'By the way / Anyway',                                           'i', 'transition', 'Changing topic',                                  220),
  ('혹시',                      'By any chance',                                                 'i', 'softening',  'Polite question opener',                          230),
  ('일단',                      'For now / First',                                               'i', 'filler',     NULL,                                             240),
  ('아무튼',                    'Anyway / Anyhow',                                               'i', 'transition', NULL,                                             250),
  -- Advanced — idioms / nuanced
  ('하늘이 무너져도',            'Even if the sky falls (no matter what)',                        'a', 'idiom',      'Strong determination',                            260),
  ('발 없는 말이 천 리 간다',    'Rumors travel fast (lit. words with no feet travel 1000 miles)','a', 'idiom',      NULL,                                             270),
  ('티끌 모아 태산',             'Many a little makes a mickle',                                  'a', 'idiom',      NULL,                                             280),
  ('백문이 불여일견',            'Seeing once is better than hearing a hundred times',            'a', 'idiom',      NULL,                                             290),
  ('소 잃고 외양간 고친다',      'Locking the barn after the horse is stolen',                    'a', 'idiom',      NULL,                                             300),
  ('숨이 막혀요',               'It''s suffocating (emotionally overwhelming)',                  'a', 'emotion',    NULL,                                             310),
  ('차마 못 하겠어요',           'I can''t bring myself to do it',                                'a', 'emotion',    NULL,                                             320),
  ('한숨이 나와요',             'I can''t help sighing',                                         'a', 'emotion',    NULL,                                             330),
  ('속이 타요',                 'I''m anxious (lit. my insides burn)',                           'a', 'emotion',    NULL,                                             340),
  ('가슴이 뭉클해요',           'My heart feels touched',                                        'a', 'emotion',    NULL,                                             350),
  -- Filler / connector (any level, conversational glue)
  ('그러니까',                  'So / That''s why',                                              'b', 'filler',     NULL,                                             360),
  ('근데',                      'But / By the way (casual)',                                     'b', 'filler',     NULL,                                             370),
  ('역시',                      'As expected / Indeed',                                          'i', 'reaction',   NULL,                                             380),
  ('하긴',                      'Well, yeah / Come to think of it',                              'i', 'agreement',  'Reluctant agreement',                            390),
  ('그래도',                    'Still / Even so',                                               'b', 'transition', NULL,                                             400)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
