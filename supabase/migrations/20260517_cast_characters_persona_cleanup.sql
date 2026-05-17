-- cast_characters: drop the per-character persona text.
--
-- Initial seed in 20260517_cast_characters.sql baked a 1-2 sentence
-- persona (voice + occupation hint) per character. Owner clarified
-- that identity should be name + age + gender ONLY — every other
-- attribute (occupation, relationship, personality colouring within
-- the scene) is set by the conv-generation prompt per conversation:
--
--   "그냥 캐릭터들 이름 성별 나이 정도만 정해주고 이미지 어떻게
--    뽑을지정도만 알려주셈. 대화에서 일회성으로 나오는 의사,
--    선생님, 경찰 이런직업은 대화 뽑고 나서 따로 이미지 만들어서
--    붙이면 되니까"
--
-- The risk of keeping persona was prompt drift — "박성호 = 카페 사장"
-- in persona would pull every conv featuring 박성호 toward a cafe
-- scene. With persona cleared, the prompt invents fresh role +
-- relationship + voice per scene every time.
--
-- The column itself stays in place (nullable) in case the admin
-- later wants to attach a short voice note. Seeded values cleared.

ALTER TABLE public.cast_characters ALTER COLUMN persona DROP NOT NULL;
UPDATE public.cast_characters SET persona = NULL;

NOTIFY pgrst, 'reload schema';
