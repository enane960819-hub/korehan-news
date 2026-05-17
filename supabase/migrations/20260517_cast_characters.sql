-- cast_characters: fixed cast for conversations (20 people).
--
-- Identity (name, image, voice core) stays fixed across every
-- conversation. Occupation / relationship / age within the scene are
-- dynamic — the conv-generation prompt overlays a role per scene, so
-- the same character can be "older brother", "coworker", or "neighbor"
-- depending on the conversation. That lets a small cast (20) cover a
-- huge variety of scenarios while still feeling consistent to the
-- learner ("ah, 박지훈 again").
--
-- Reporters live in character_reporters and stay reserved for stories
-- / news / webnovel surfaces. They do NOT mix into the conversation
-- casting per owner decision: "conversations 엔 리포터 넣지 말자.
-- 리포터는 스토리 코리하니뉴스 웹소설에만 등장시킬거임".
--
-- RLS: anyone can read active rows; admin writes via service-role.

CREATE TABLE IF NOT EXISTS public.cast_characters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  name_en      text,
  persona      text NOT NULL,
  image_url    text,
  age_band     text,
  gender       text,
  sort_order   int  NOT NULL DEFAULT 100,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cast_characters_active_sort_idx
  ON public.cast_characters (active, sort_order);

ALTER TABLE public.cast_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cast_characters public read" ON public.cast_characters;
CREATE POLICY "cast_characters public read"
  ON public.cast_characters
  FOR SELECT
  TO public
  USING (active = true);

-- Storage bucket for pixel-art avatars uploaded from the admin panel.
-- Public read so plain <img src> works (no signed URLs needed); admin
-- uploads via service role. 2MB cap is way over what pixel-art needs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-avatars',
  'character-avatars',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Seed: 20 characters spanning teens → 60s, both genders, diverse
-- occupation hints so the conv prompt has plausible casting for any
-- scenario (school, workplace, family, neighborhood, etc.).
-- image_url left null on seed — admin uploads pixel art via the cast
-- management UI (PR 2). Until then, frontend falls back to the
-- existing color-circle avatar.
INSERT INTO public.cast_characters (slug, name, name_en, persona, age_band, gender, sort_order)
VALUES
  ('jung-tae-young',  '정태영', 'Jung Tae-young',  '17살 고등학생. 게임과 친구를 좋아하고 말투가 가볍지만 정 많음.',     'teens',    'm',  10),
  ('lee-su-min',      '이수민', 'Lee Su-min',      '16살 고등학생. 책과 음악에 진심이고 차분한 말투. 진로 고민 많음.',   'teens',    'f',  20),
  ('park-ji-hoon',    '박지훈', 'Park Ji-hoon',    '24살 대학생. 활발하고 사람 많이 만남. 농담을 자주 함.',             'twenties', 'm',  30),
  ('kim-min-ah',      '김민아', 'Kim Min-ah',      '22살 대학생. 조용하고 책 좋아하는 타입. 깊게 생각하고 천천히 말함.',  'twenties', 'f',  40),
  ('im-do-yoon',      '임도윤', 'Im Do-yoon',      '24살 음악 지망생. 자유로운 영혼이고 밤형. 카페 알바 + 디제잉.',     'twenties', 'm',  50),
  ('han-seung-ho',    '한승호', 'Han Seung-ho',    '26살 막 제대한 청년. 진지하고 책임감 있음. 운동광.',                'twenties', 'm',  60),
  ('lee-seo-yeon',    '이서연', 'Lee Seo-yeon',    '28살 디자이너. 감각적이고 트렌디한 말투. SNS에 관심 많음.',         'twenties', 'f',  70),
  ('jung-hyun-woo',   '정현우', 'Jung Hyun-woo',   '29살 IT 회사원. 진지하고 일에 진심. 야근 잦고 약속 자주 미룸.',     'twenties', 'm',  80),
  ('kang-yu-jin',     '강유진', 'Kang Yu-jin',     '32살 마케터. 추진력 강하고 직설적. 일과 생활 분리 못 함.',          'thirties', 'f',  90),
  ('park-sung-ho',    '박성호', 'Park Sung-ho',    '34살 카페 사장. 여유롭고 친절한 말투. 동네 단골 많음.',             'thirties', 'm', 100),
  ('cho-yeon-ju',     '조연주', 'Cho Yeon-ju',     '30살 간호사. 헌신적이고 야간 근무 많음. 피곤해도 다정함.',          'thirties', 'f', 110),
  ('song-mi-kyung',   '송미경', 'Song Mi-kyung',   '35살 꽃집 주인. 섬세하고 예술적. 손님과 짧은 대화 즐김.',          'thirties', 'f', 120),
  ('kim-hye-soo',     '김혜수', 'Kim Hye-soo',     '38살 변호사. 똑똑하고 일 중심. 말이 정확하고 빠름.',                'thirties', 'f', 130),
  ('lee-jae-min',     '이재민', 'Lee Jae-min',     '40살 회사 부장. 책임감 있고 가정적. 후배에게 다정함.',              'forties',  'm', 140),
  ('choi-yeong-ah',   '최영아', 'Choi Yeong-ah',   '42살 두 아이 엄마. 따뜻하고 가족 우선. 알바 병행.',                  'forties',  'f', 150),
  ('yoon-sang-jin',   '윤상진', 'Yoon Sang-jin',   '45살 식당 사장. 시원시원하고 손님과 잘 어울림. 가족 부양.',         'forties',  'm', 160),
  ('han-ji-young',    '한지영', 'Han Ji-young',    '48살 학원 강사. 엄격하지만 학생 잘 챙김. 책임감 강함.',             'forties',  'f', 170),
  ('kim-sun-hee',     '김순희', 'Kim Sun-hee',     '52살 은퇴 교사. 인자하고 손주 사랑. 옛날 이야기 좋아함.',           'fifties',  'f', 180),
  ('park-cheol-min',  '박철민', 'Park Cheol-min',  '55살 회사 임원. 위엄 있고 옛날 말투. 후배에게 충고 즐김.',          'fifties',  'm', 190),
  ('shin-kyung-ho',   '신경호', 'Shin Kyung-ho',   '60살 은퇴 사장. 인생 경험 많고 사색적. 손주들과 자주 만남.',         'sixties+', 'm', 200)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
