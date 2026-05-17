-- role_characters: pool of one-off role NPCs (doctor, police, teacher, ...)
-- that can be reused across conversations.
--
-- Design: cast_characters holds the 20 recurring main people (identity
-- = name + age + gender only; occupation is conv-driven). But scenes
-- regularly need an extra speaker who only exists FOR a role —
-- doctor in a clinic conv, police officer at a checkpoint, teacher
-- at a parent meeting. Owner doesn't want to bloat the main cast
-- with every imaginable profession, and also doesn't want a brand
-- new face every time the same role recurs.
--
-- Solution: separate pool keyed by role. First conv that needs
-- "의사" creates one and saves it here (name, gender, age band,
-- avatar). Next conv that needs a doctor reuses the same row —
-- learners start recognising that face as "Dr. So-and-so".
--
-- Owner: "대화에서 일회성으로 나오는 의사, 선생님, 경찰 이런직업은
-- 대화 뽑고 나서 따로 이미지 만들어서 붙이면 되니까" + "한번 저장한
-- 직업 캐릭터는 나중에 그 직업이 다른 대화에서 등장하는 경우에는
-- 그냥 dB에서 가져다 쓰면 되게 하자".
--
-- Avatars share the existing character-avatars bucket (no separate
-- bucket needed). Frontend renders cast + role NPCs identically;
-- the conv prompt is told both pools are available.

CREATE TABLE IF NOT EXISTS public.role_characters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role         text NOT NULL,            -- 의사 / 경찰 / 선생님 / 기사 / 점원 / etc.
  name         text NOT NULL,            -- Korean given name
  name_en      text,
  age_band     text,                     -- 'teens' | 'twenties' | 'thirties' | 'forties' | 'fifties' | 'sixties+'
  gender       text,                     -- 'm' | 'f' | 'nb'
  image_url    text,                     -- avatar in character-avatars bucket; null until admin uploads
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per role is the typical case (the conv prompt grabs the
-- existing 의사 row instead of inventing a new face every time), but
-- we don't enforce uniqueness — admin may want multiple 의사 entries
-- (e.g. male/female, different specialties) and let the prompt pick.
CREATE INDEX IF NOT EXISTS role_characters_role_active_idx
  ON public.role_characters (role, active);

ALTER TABLE public.role_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_characters public read" ON public.role_characters;
CREATE POLICY "role_characters public read"
  ON public.role_characters
  FOR SELECT
  TO public
  USING (active = true);

NOTIFY pgrst, 'reload schema';
